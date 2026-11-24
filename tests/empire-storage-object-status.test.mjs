import test from 'node:test';import assert from 'node:assert/strict';
import {isMissingObject,assertMissingObject} from '../scripts/empire-storage-object-status.mjs';
test('legacy and current missing object only',()=>{
 for(const [status,body] of [[400,{statusCode:'404',error:'not_found',message:'Object not found'}],[404,{statusCode:404,error:'not_found',message:'Object not found'}],[404,{code:'NoSuchKey',message:'Object not found'}],[400,{code:'NoSuchKey',message:'Object not found'}]])assert.equal(isMissingObject(status,body),true);
 for(const [status,body] of [[400,{statusCode:'400',error:'not_found',message:'Object not found'}],[400,{error:'not_found',message:'Object not found'}],[400,{statusCode:'404',error:'Bucket not found',message:'Bucket not found'}],[403,{statusCode:'404',error:'not_found',message:'Object not found'}],[404,{error:'not_found',message:'Bucket not found'}],[400,{error:'InvalidJWT',message:'Invalid JWT'}],[404,null],[500,{code:'NoSuchKey'}]])assert.equal(isMissingObject(status,body),false);
});
test('unrecognized response fails closed',async()=>{
 await assertMissingObject({status:400,json:async()=>({statusCode:'404',error:'not_found',message:'Object not found'})},'lookup');
 await assert.rejects(assertMissingObject({status:400,json:async()=>({error:'Unauthorized'})},'lookup'),/never overwrite uncertain state/);
 await assert.rejects(assertMissingObject({status:404,json:async()=>{throw Error('bad JSON')}},'lookup'),/never overwrite uncertain state/);
});
