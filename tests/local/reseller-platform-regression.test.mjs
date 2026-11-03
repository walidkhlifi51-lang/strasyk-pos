import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from '@babel/parser';
import {loadResellerPlatform,resellerReadErrorCode,RESELLER_COMMISSION_FIELDS,RESELLER_PAYOUT_FIELDS} from '../../src/lib/resellerPlatformReadModel.js';
import {resellerPortalRedirect} from '../../src/lib/resellerAccess.js';
import {resolveIdentityAccess} from '../../src/lib/identityAccess.js';

const find=(n,predicate)=>{
 if(!n||typeof n!=='object')return null;if(predicate(n))return n;
 for(const value of Object.values(n)){
  if(Array.isArray(value)){for(const item of value){const got=find(item,predicate);if(got)return got;}}
  else if(value&&typeof value==='object'){const got=find(value,predicate);if(got)return got;}
 }return null;
};
const parseJs=source=>parse(source,{sourceType:'module',plugins:['jsx']});
const pageSource=readFileSync('src/pages/ResellersPlatform.jsx','utf8');const pageAst=parseJs(pageSource);
const query=find(pageAst,n=>n.type==='CallExpression'&&n.callee?.name==='useQuery').arguments[0].properties.find(p=>p.key.name==='queryFn').value;
const fields={RESELLER_PLATFORM_COMMISSION_FIELDS:RESELLER_COMMISSION_FIELDS,RESELLER_PLATFORM_PAYOUT_FIELDS:RESELLER_PAYOUT_FIELDS};
for(const node of pageAst.program.body){if(node.type==='VariableDeclaration')for(const d of node.declarations)if(d.id?.name.startsWith('RESELLER_PLATFORM_')&&d.init?.type==='ArrayExpression')fields[d.id.name]=d.init.elements.map(e=>e.value);}
const loadPage=Function('appClient','loadResellerPlatform',...Object.keys(fields),`return (${pageSource.slice(query.start,query.end)})();`);
const fixture={id:'fixture-reseller',name:'Revendeur fictif',type:'white_label',status:'active'};
const knownCommissionColumns=['id','reseller_id','tenant_id','source_type','source_reference','period_start','period_end','base_amount','commission_amount','status','notes','created_date','updated_date'];
const knownPayoutColumns=['id','reseller_id','period_start','period_end','total_amount','status','paid_at','payment_reference','notes','created_date','updated_date'];
function transport(failures={}){
 const calls=[];
 return {calls,entities:new Proxy({},{get:(_,entity)=>({list:async(_sort,_limit,options)=>{
  calls.push(entity);if(failures[entity])throw failures[entity];
  const columns=entity==='ResellerCommission'?knownCommissionColumns:entity==='ResellerPayout'?knownPayoutColumns:null;
  if(columns)assert.deepEqual(options.fields.filter(f=>!columns.includes(f)),[],'unknown deployed column');
  return entity==='Reseller'?[fixture]:[];
 }})})};
}
const runPage=client=>loadPage(client,loadResellerPlatform,...Object.values(fields));
test('actual page query uses valid deployed financial projections and keeps reseller',async()=>{
 const model=await runPage(transport());assert.deepEqual(model.resellers,[fixture]);assert.deepEqual(model.loadErrors,[]);
});
for(const entity of ['ResellerCommission','ResellerPayout'])test(`${entity} unavailable does not erase the reseller list`,async()=>{
 const model=await runPage(transport({[entity]:{code:'42703',message:'sensitive raw details'}}));
 assert.deepEqual(model.resellers,[fixture]);assert.equal(model.loadErrors.length,1);assert.equal(model.loadErrors[0].code,'42703');
 assert.ok(!JSON.stringify(model).includes('sensitive raw details'));
});
test('both financial sources unavailable retain reseller and independent errors',async()=>{
 const client=transport({ResellerCommission:{code:'42501'},ResellerPayout:{code:'PGRST000'}});const model=await runPage(client);
 assert.equal(model.resellers.length,1);assert.deepEqual(model.loadErrors.map(e=>e.resource),['commissions','payouts']);assert.equal(client.calls.length,10);
});
test('failed reseller read remains a controlled fatal error rather than empty success',async()=>{
 await assert.rejects(runPage(transport({Reseller:{code:'42501',message:'do not display'}})),e=>e.message==='RESELLER_LIST_UNAVAILABLE'&&e.code==='42501');
});
test('invalid response and synchronous auxiliary error are reported without losing core data',async()=>{
 const model=await loadResellerPlatform({resellers:()=>[fixture],commissions:()=>({}),payouts:()=>{throw Error('private detail');}});
 assert.equal(model.resellers.length,1);assert.deepEqual(model.loadErrors,[{resource:'commissions',code:'INVALID_RESPONSE'},{resource:'payouts',code:'READ_UNAVAILABLE'}]);
});
test('untrusted error messages and malformed codes are never returned for display',()=>{
 assert.equal(resellerReadErrorCode({message:'secret',code:'email@example.test'}),'READ_UNAVAILABLE');
 assert.equal(resellerReadErrorCode({message:'secret',code:'42703'}),'42703');
});
test('page and generic entity client share the deployed projection constants',()=>{
 const client=parseJs(readFileSync('src/api/supabase/appClient.js','utf8'));
 const declaration=find(client,n=>n.type==='VariableDeclarator'&&n.init?.type==='ObjectExpression'
  && ['ResellerCommission','ResellerPayout'].every(key=>n.init.properties.some(p=>p.key?.name===key&&p.value?.type==='Identifier')));
 assert.ok(declaration,'shared projection object must exist');
 const map=declaration.init;
 assert.equal(map.properties.find(p=>p.key.name==='ResellerCommission').value.name,'RESELLER_COMMISSION_FIELDS');
 assert.equal(map.properties.find(p=>p.key.name==='ResellerPayout').value.name,'RESELLER_PAYOUT_FIELDS');
 assert.ok(RESELLER_COMMISSION_FIELDS.includes('source_reference'));assert.ok(RESELLER_PAYOUT_FIELDS.includes('payment_reference'));
 assert.ok(!RESELLER_COMMISSION_FIELDS.includes('invoice_id'));assert.ok(!RESELLER_PAYOUT_FIELDS.includes('amount'));
 const imports=pageAst.program.body.filter(n=>n.type==='ImportDeclaration').flatMap(n=>n.specifiers);
 assert.ok(imports.some(s=>s.imported?.name==='RESELLER_COMMISSION_FIELDS'&&s.local.name==='RESELLER_PLATFORM_COMMISSION_FIELDS'));
});
test('page renders controlled fatal and partial error states, with unavailable totals',()=>{
 assert.ok(find(pageAst,n=>n.type==='IfStatement'&&n.test.type==='Identifier'&&n.test.name==='loadError'));
 assert.ok(pageSource.includes('resellerReadErrorCode(loadError)'));assert.ok(pageSource.includes('RESELLER_RESOURCE_LABELS[resource]'));
 assert.ok(pageSource.includes("unavailable.has('commissions') ? 'Indisponible'"));assert.ok(pageSource.includes("unavailable.has('payouts') ? 'Indisponible'"));
 assert.ok(!pageSource.includes('description: loadError.message'));
});

const user={id:'fixture-auth-subject'};
const identity=(patch={})=>({version:1,user_id:user.id,is_platform_admin:false,memberships:[],selected_tenant_id:null,resellers:[],...patch});
const reseller=(status='active')=>resolveIdentityAccess(user,identity({resellers:[{reseller:{id:'fixture-reseller',status:'active',type:'white_label'},role:'manager',status}]}));
const tenantSource=readFileSync('src/components/contexts/TenantContext.jsx','utf8');
const redirectEffect=find(parseJs(tenantSource),n=>n.type==='CallExpression'&&n.callee?.name==='useEffect'&&tenantSource.slice(n.arguments[0].start,n.arguments[0].end).includes('resellerPortalRedirect')).arguments[0];
function effectRedirect(access,path){
 const calls=[];Function('tenantData','location','navigate','resellerPortalRedirect',`return (${tenantSource.slice(redirectEffect.start,redirectEffect.end)})();`)(access,{pathname:path},(...args)=>calls.push(args),resellerPortalRedirect);return calls;
}
for(const path of ['/','/Dashboard','/Pos','/Clients','/Statistiques','/AdminTenants'])test(`active reseller is redirected from ${path} to portal`,()=>{
 assert.deepEqual(effectRedirect(reseller(),path),[['/ResellerPortal',{replace:true}]]);
});
test('portal does not redirect in a loop; suspended and missing identities are unchanged',()=>{
 assert.deepEqual(effectRedirect(reseller(),'/ResellerPortal'),[]);assert.deepEqual(effectRedirect(reseller('suspended'),'/'),[]);assert.deepEqual(effectRedirect(null,'/'),[]);
});
test('STRASYK administrator retains its requested administration route',()=>{
 const admin=resolveIdentityAccess(user,identity({is_platform_admin:true}));assert.equal(admin.isPlatformAdmin,true);
 assert.deepEqual(effectRedirect(admin,'/'),[]);assert.deepEqual(effectRedirect(admin,'/AdminTenants'),[]);
});
test('reseller remains without tenant or platform privileges and POS guard is retained',()=>{
 const access=reseller();assert.equal(access.tenant,null);assert.equal(access.isPlatformAdmin,false);
 const layoutSource=readFileSync('src/Layout.jsx','utf8');const layout=parseJs(layoutSource);
 const guard=find(layout,n=>n.type==='IfStatement'&&layoutSource.slice(n.test.start,n.test.end)==="isReseller && currentPageName !== 'ResellerPortal'");
 assert.ok(guard);const rejects=Function('isReseller','currentPageName',`return ${layoutSource.slice(guard.test.start,guard.test.end)};`);
 for(const page of ['Pos','Clients','Statistiques','Encaissements','Comptabilite','Dashboard'])assert.equal(rejects(access.isReseller,page),true);
 assert.equal(rejects(access.isReseller,'ResellerPortal'),false);assert.equal(rejects(false,'AdminTenants'),false);
});
