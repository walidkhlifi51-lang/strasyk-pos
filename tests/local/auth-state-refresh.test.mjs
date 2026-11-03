import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import { setTimeout as pause } from 'node:timers/promises';

const source=readFileSync('src/lib/AuthContext.jsx','utf8');
const ast=parse(source,{sourceType:'module',plugins:['jsx']});
let effect;
function walk(node){
 if(!node||typeof node!=='object')return;
 if(node.type==='CallExpression'&&node.callee?.name==='useEffect')effect=node.arguments[0];
 for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
}
walk(ast);
assert.ok(effect);
function mount(){
 let callback;const state={checks:0,clears:0,unsubscribes:0};
 const cleanup=Function('authService','checkUserAuth','clearIdentity','requestId','setIsLoadingAuth','setAuthChecked','setAuthError',
  `return (${source.slice(effect.start,effect.end)})();`)(
  {onAuthStateChange:fn=>{callback=fn;return()=>{state.unsubscribes++;};}},
  ()=>{state.checks++;},()=>{state.clears++;},{current:0},()=>{},()=>{},()=>{});
 return {state,emit:event=>callback(event),cleanup};
}
test('auth events defer SDK reads beyond the microtask queue',async()=>{
 const h=mount();try{
  assert.equal(h.state.checks,1);h.emit('SIGNED_IN');await Promise.resolve();
  assert.equal(h.state.checks,1);await pause(15);assert.equal(h.state.checks,2);
 }finally{h.cleanup();}
});
test('refresh event bursts coalesce without dropping the refresh check',async()=>{
 const h=mount();try{
  h.emit('TOKEN_REFRESHED');h.emit('USER_UPDATED');await pause(15);
  assert.equal(h.state.checks,2);
 }finally{h.cleanup();}
});
test('sign-out cancels queued identity reads and clears immediately',async()=>{
 const h=mount();try{
  h.emit('TOKEN_REFRESHED');h.emit('SIGNED_OUT');assert.equal(h.state.clears,1);
  await pause(15);assert.equal(h.state.checks,1);
 }finally{h.cleanup();}
});
test('unmount cancels deferred identity work and unsubscribes',async()=>{
 const h=mount();h.emit('SIGNED_IN');h.cleanup();await pause(15);
 assert.equal(h.state.checks,1);assert.equal(h.state.unsubscribes,1);
});
