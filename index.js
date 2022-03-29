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
const { ResourceManagementClient } = require("@azure/arm-resources");
const { setLogLevel } = require("@azure/logger");
setLogLevel("error");

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

async function login(tenant = null) {
  const browserCredential = new InteractiveBrowserCredential({
    redirectUri: "http://localhost:8888",
    tokenCachePersistenceOptions,
    tenantId: tenant?.tenantId,
  });
  const deviceCredential = new DeviceCodeCredential({
    tokenCachePersistenceOptions,
    tenantId: tenant?.tenantId,
  });
  const credentialChain = new ChainedTokenCredential(browserCredential, deviceCredential);
  return { credentialChain };
}

async function listTenants(credentialChain) {
  const client = new SubscriptionClient(credentialChain);
  const tenants = [];
  for await (let tenant of client.tenants.list()) {
    tenants.push(tenant);
  }
  return tenants;
}

async function listResourceGroups(credentialChain, subscriptionId) {
  const client = new ResourceManagementClient(credentialChain, subscriptionId);
  const resourceGroups = [];
  for await (let resource of client.resources.list()) {
    resourceGroups.push(resource);
  }
  return resourceGroups;
}

async function listSubscriptions(credentialChain) {
  const client = new SubscriptionClient(credentialChain);
  const subscriptions = [];
  for await (let subscription of client.subscriptions.list()) {
    subscriptions.push(subscription);
  }
  return subscriptions;
}

async function listStaticSites(credentialChain, subscriptionId) {
  const client = new WebSiteManagementClient(credentialChain, subscriptionId);

  const staticSites = [];
  for await (let staticSite of client.staticSites.list()) {
    staticSites.push(staticSite);
  }
  return staticSites;
}

async function chooseTenant(tenants) {
  const choices = tenants.map((tenant) => ({
    title: tenant.tenantId,
    value: tenant,
  }));
  const response = await prompts({
    type: "select",
    name: "Tenant",
    message: "Choose your tenant",
    choices,
  });
  return response.Tenant;
}

async function chooseResourceGroup(resourceGroups) {
  const choices = resourceGroups.map((resourceGroup) => ({
    title: resourceGroup.name,
    value: resourceGroup,
  }));
  const response = await prompts({
    type: "select",
    name: "ResourceGroup",
    message: "Choose your resource group",
    choices,
  });
  return response.ResourceGroup;
}

async function chooseSubscription(subscriptions) {
  const choices = subscriptions.map((subscription) => ({
    title: subscription.displayName,
    value: subscription,
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

async function getStaticSiteDeployment(credentialChain, subscription, resourceGroup, staticSite) {
  const websiteClient = new WebSiteManagementClient(credentialChain, subscription.subscriptionId);
  const deploymentTokenResponse = await websiteClient.staticSites.listStaticSiteSecrets(resourceGroup.name, staticSite.name);
  return deploymentTokenResponse;
}

(async () => {
  let { credentialChain } = await login();
  let tenant;

  const tenants = await listTenants(credentialChain);
  if (tenants.length === 0) {
    console.log("No tenants found");
    process.abort();
  } else if (tenants.length === 1) {
    console.log("Only one tenant found");
    tenant = tenants[0];
  } else {
    tenant = await chooseTenant(tenants);
    // login again with the new tenant
    ({ credentialChain } = await login(tenant));
  }


  const subscriptions = await listSubscriptions(credentialChain);
  let subscription;
  if (subscriptions.length === 0) {
    console.log("No subscriptions found");
    process.abort();
  }
  else if (subscriptions.length === 1) {
    console.log("Only one subscription found");
    subscription = subscriptions[0];
  }
  else {
    subscription = await chooseSubscription(subscriptions);
  }

  const resourceGroups = await listResourceGroups(credentialChain, subscription.subscriptionId);
  let resourceGroup;
  if (resourceGroups.length === 0) {
    console.log("No resource groups found");
    process.abort();
  }
  else if (resourceGroups.length === 1) {
    console.log("Only one resource group found");
    resourceGroup = resourceGroups[0];
  }
  else {
    resourceGroup = await chooseResourceGroup(resourceGroups);
  }

  const staticSites = await listStaticSites(credentialChain, subscription.subscriptionId);
  let staticSite;
  if (staticSites.length === 0) {
    console.log("No static sites found");
    process.abort();
  }
  else if (staticSites.length === 1) {
    console.log("Only one static site found");
    staticSite = staticSites[0];
  }
  else {
    staticSite = await chooseStaticSite(staticSites);
  }

  const deploymentTokenResponse = await getStaticSiteDeployment(
    credentialChain,
    subscription,
    resourceGroup,
    staticSite
  );

  console.log(`Found deployment token:`);
  console.log(deploymentTokenResponse.properties.apiKey);
})();
