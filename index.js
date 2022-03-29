
const { DeviceCodeCredential, InteractiveBrowserCredential, ChainedTokenCredential, useIdentityPlugin } = require("@azure/identity");
const { SubscriptionClient } = require("@azure/arm-subscriptions");
const { cachePersistencePlugin } = require("@azure/identity-cache-persistence");

useIdentityPlugin(cachePersistencePlugin);

async function login() {
  const browserCredential = new InteractiveBrowserCredential({
    redirectUri: "http://localhost:1337",
    tokenCachePersistenceOptions: {
      enabled: true
    }
  });
  const deviceCredential = new DeviceCodeCredential({
    tokenCachePersistenceOptions: {
      enabled: true
    }
  });
  const credentialChain = new ChainedTokenCredential(browserCredential, deviceCredential);
  
  let subscriptionClient = new SubscriptionClient(credentialChain);
  let subscriptions = await subscriptionClient.subscriptions.list();
  for await (let subscription of subscriptions) {

    console.log(subscription);
  }
}

login();
