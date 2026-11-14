#!/usr/bin/env node
'use strict';
/**
 * Generate a visibly NONFUNCTIONAL Google Services resource solely to let
 * the existing Firebase Gradle plugin parse a completely offline prototype.
 * No real Firebase account, client, key or API is represented.
 * Never use in main, staging-user, classroom or production.
 */
const fs = require('node:fs');
const path = require('node:path');
if (process.env.BUKLOD_APP_TARGET !== 'kingdom-native-lab') {
  throw new Error('Offline Firebase test resource generation is native-lab-only.');
}
const output = path.resolve(__dirname,'../../google-services.kingdomlab.offline.json');
const data = {
  project_info: {
    project_number:'000000000000',
    project_id:'buklod-kingdom-native-lab-offline',
    storage_bucket:'buklod-native-lab-offline.invalid'
  },
  client: [{
    client_info:{
      mobilesdk_app_id:'1:000000000000:android:0000000000000000000000',
      android_client_info:{package_name:'org.mzbministry.buklod.kingdomlab'}
    },
    api_key:[{current_key:'OFFLINE-LAB-NO-REAL-KEY'}],
    oauth_client:[],
    services:{appinvite_service:{other_platform_oauth_client:[]}}
  }],
  configuration_version:'1'
};
fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n',{mode:0o600});
console.info('Created offline-only, intentionally invalid Firebase Gradle placeholder (not a real registration).');
