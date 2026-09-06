import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin='http://localhost:3000';
let cookie='';let checks=0;
async function call(path,method='GET',data,options={}){const r=await fetch(origin+path,{method,headers:{...(method==='GET'?{}:{Origin:origin}),'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...options.headers},body:data===undefined?undefined:JSON.stringify(data)});const raw=await r.text();let b;try{b=JSON.parse(raw);}catch{b={error:'Non-JSON response',status:r.status};}return {r,b};}
const check=(value,message)=>{assert.ok(value,message);checks++;};
for(const path of ['/api/posts','/api/integrations','/api/publish','/api/inbox?account=none','/api/media?id=none']){const {r}=await call(path);check(r.status===401,'Unauthenticated access blocked: '+path);}
let t=await call('/api/auth','POST',{email:'other@example.com',password:'invalid'});check(t.r.status===401,'Wrong credentials rejected');
const password=process.env.TEST_PASSWORD;if(!password)throw new Error('Set TEST_PASSWORD for the local test account.');
t=await call('/api/auth','POST',{email:'ads.cleverclouds.in@gmail.com',password});check(t.r.status===200,'Valid sign-in: '+JSON.stringify(t.b));cookie=t.r.headers.get('set-cookie').split(';')[0];check(t.r.headers.get('set-cookie').includes('HttpOnly'),'HttpOnly session cookie');
t=await call('/api/posts','POST',{title:'CSRF test'},{headers:{Origin:'https://invalid.example'}});check(t.r.status===403,'Cross-origin writes rejected');
const base={title:'API verification post',content:'Testing durable content.',platforms:['X','LinkedIn'],variants:{X:'Testing X variant'},scheduled_at:null,status:'draft'};
t=await call('/api/posts','POST',base);check(t.r.status===200,'Draft saved: '+JSON.stringify(t.b));const id=t.b.id;
t=await call('/api/posts');let post=t.b.find(p=>p.id===id);check(post?.variants.X==='Testing X variant','Draft and variants read back');
t=await call('/api/posts','POST',{...base,id,version:post.version,title:'Updated title'});check(t.r.status===200,'Draft updated');
t=await call('/api/posts','POST',{...base,id,version:post.version});check(t.r.status===409,'Stale write rejected');
t=await call('/api/posts','POST',{...base,content:'a'.repeat(281),variants:{},platforms:['X']});check(t.r.status===400,'X character limit checked server-side');
t=await call('/api/posts','POST',{...base,status:'planned',scheduled_at:'2020-01-01T10:00:00Z'});check(t.r.status===400,'Past calendar dates rejected');
t=await call('/api/posts');post=t.b.find(p=>p.id===id);
t=await call('/api/posts','POST',{...base,id,version:post.version,status:'planned',scheduled_at:new Date(Date.now()+86400000).toISOString()});check(t.r.status===200,'Future plan saved');
t=await call('/api/integrations');if(t.b.configured.some(p=>p.id==='x'))throw new Error('Run credential tests against a fresh local database; an X integration already exists.');
t=await call('/api/integrations','POST',{provider:'x',clientId:'verification-client',clientSecret:'verification-secret'});check(t.r.status===200,'Credential save: '+JSON.stringify(t.b));
t=await call('/api/integrations');check(t.b.configured.some(p=>p.id==='x'),'Credential metadata read back');check(!JSON.stringify(t.b).includes('verification-secret'),'Secret not returned by API');check(!JSON.stringify(t.b).includes('verification-client'),'Client ID masked');
t=await call('/api/connect/x','POST');check(t.r.status===200&&new URL(t.b.url).searchParams.get('code_challenge_method')==='S256','OAuth URL uses PKCE S256');check(!t.b.url.includes('verification-secret'),'Secret absent from OAuth URL');
t=await call('/api/integrations','DELETE',{provider:'x'});check(t.r.status===200,'Test credentials removed');
t=await call('/api/posts');post=t.b.find(p=>p.id===id);
t=await call('/api/posts','DELETE',{id,version:post.version});check(t.r.status===200,'Test post removed');
t=await call('/api/auth','DELETE');check(t.r.status===200,'Logout succeeded');t=await call('/api/posts');check(t.r.status===401,'Session revoked server-side');
console.log(`PASS: ${checks} API checks. No external platform requests or publishing performed.`);
