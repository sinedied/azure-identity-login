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

let tokenCachePersistenceOptions = {
  enabled: false,
  name: "identity.cache",
  // avoid error: Unable to read from the system keyring (libsecret).
  unsafeAllowUnencryptedStorage: true,
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

  const subscriptionClient = new SubscriptionClient(credentialChain);

  for await (let subscription of subscriptionClient.subscriptions.list()) {
    console.log(
      `Static web apps in subscription ${subscription.displayName} (${subscription.id}):`
    );
    const websiteClient = new WebSiteManagementClient(
      credentialChain,
      subscription.subscriptionId
    );

    for await (let site of websiteClient.staticSites.list()) {
      console.log(`- ${site.name} (${site.id})`);
    }
  }
}

(async () => {
  await login();
})();
