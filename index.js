
const { DeviceCodeCredential, InteractiveBrowserCredential, ChainedTokenCredential, useIdentityPlugin } = require("@azure/identity");
const { cachePersistencePlugin } = require("@azure/identity-cache-persistence");
const { SubscriptionClient } = require("@azure/arm-subscriptions");
const { WebSiteManagementClient } = require("@azure/arm-appservice");

const tokenCachePersistenceOptions = {
  name: "identity.cache",
  enabled: true,
  // unsafeAllowUnencryptedStorage: true
}

useIdentityPlugin(cachePersistencePlugin);

async function login() {
  const browserCredential = new InteractiveBrowserCredential({
    redirectUri: "http://localhost:1337",
    tokenCachePersistenceOptions
  });
  const deviceCredential = new DeviceCodeCredential({
    tokenCachePersistenceOptions
  });
  const credentialChain = new ChainedTokenCredential(browserCredential, deviceCredential);
  
  const subscriptionClient = new SubscriptionClient(credentialChain);
  const subscriptions = await subscriptionClient.subscriptions.list();

  for await (let subscription of subscriptions) {
    console.log(`Static web apps in subscription ${subscription.displayName}:`);
    const websiteClient = new WebSiteManagementClient(credentialChain, subscription.subscriptionId);
    const staticSites = await websiteClient.staticSites.list();
    for await (let site of staticSites) {
      console.log(`- ${site.name} (${site.id})`);
    }
  }
}

login();
