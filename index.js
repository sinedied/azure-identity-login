const {
  DeviceCodeCredential,
  InteractiveBrowserCredential,
  ChainedTokenCredential,
  useIdentityPlugin,
} = require("@azure/identity");
const { cachePersistencePlugin } = require("@azure/identity-cache-persistence");
const { vsCodePlugin } = require("@azure/identity-vscode");
const { SubscriptionClient } = require("@azure/arm-subscriptions");
const { WebSiteManagementClient } = require("@azure/arm-appservice");

const prompts = require("prompts");

let tokenCachePersistenceOptions = {
  enabled: false,
  name: "identity.cache",
  // avoid error: Unable to read from the system keyring (libsecret).
  unsafeAllowUnencryptedStorage: false,
};

if (process.env.AZURE_IDENTITY_ENABLE_CACHE_PERSISTENCE) {
  useIdentityPlugin(cachePersistencePlugin);
  useIdentityPlugin(vsCodePlugin);
  tokenCachePersistenceOptions.enabled = true;
}

async function login() {
  const browserCredential = new InteractiveBrowserCredential({
    redirectUri: "http://localhost:8888",
    tokenCachePersistenceOptions,
  });
  const deviceCredential = new DeviceCodeCredential({
    tokenCachePersistenceOptions,
  });
  const credentialChain = new ChainedTokenCredential(
    browserCredential,
    deviceCredential
  );
  return { credentialChain };
}

async function listSubscriptions(credentialChain) {
  const subscriptionClient = new SubscriptionClient(credentialChain);
  const subscriptions = [];
  for await (let subscription of subscriptionClient.subscriptions.list()) {
    subscriptions.push(subscription);
  }
  return subscriptions;
}

async function listStaticSites(credentialChain, subscriptionId) {
  const websiteClient = new WebSiteManagementClient(
    credentialChain,
    subscriptionId
  );

  const staticSites = [];
  for await (let staticSite of websiteClient.staticSites.list()) {
    staticSites.push(staticSite);
  }
  return staticSites;
}

async function chooseSubscription(subscriptions) {
  const choices = subscriptions.map((subscription) => ({
    title: subscription.displayName,
    value: subscription.subscriptionId,
  }));
  const response = await prompts({
    type: "select",
    name: "Subscription",
    message: "Choose your subscription",
    choices,
  });
  return response.Subscription;
}

async function chooseStaticSite(staticSites) {
  const choices = staticSites.map((staticSite) => ({
    title: staticSite.name,
    value: staticSite,
  }));
  const response = await prompts({
    type: "select",
    name: "staticSite",
    message: "Choose your Static Web App",
    choices,
  });
  return response.staticSite;
}

async function staticSiteDeployment(
  credentialChain,
  subscriptionId,
  resourceGroup,
  staticSite
) {
  const websiteClient = new WebSiteManagementClient(
    credentialChain,
    subscriptionId
  );
  const deploymentTokenResponse =
    await websiteClient.staticSites.listStaticSiteSecrets(
      resourceGroup,
      staticSite.name
    );
  return deploymentTokenResponse;
}

(async () => {
  const { credentialChain } = await login();
  const subscriptions = await listSubscriptions(credentialChain);
  const subscriptionId = await chooseSubscription(subscriptions);
  const staticSites = await listStaticSites(credentialChain, subscriptionId);
  const staticSite = await chooseStaticSite(staticSites);
  const resourceGroup = staticSite.id.split("/")[4];
  const deploymentTokenResponse = await staticSiteDeployment(
    credentialChain,
    subscriptionId,
    resourceGroup,
    staticSite
  );

  console.log(`Found deployment token:`);
  console.log(deploymentTokenResponse.properties.apiKey);
})();
