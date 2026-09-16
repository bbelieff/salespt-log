// Manual browser fixture: real installed Sentry SDK; synthetic token and in-memory transport only.
import * as Sentry from '@sentry/browser';
import {serializeEnvelope} from '@sentry/core';
import {containsRecruitmentUrl,isSensitiveRecruitmentUrl,scrubRecruitmentTelemetry} from '../../../lib/util/recruitment-privacy';
const fixed=new URLSearchParams(location.search).get('fixed')==='true';
const token='Z'.repeat(43);
const envelopes=[];
window.qaEnvelopes=envelopes;
history.replaceState(null,'','/trainer/invite#token='+token);
Sentry.init({dsn:'https://publictest@localhost/1',sendDefaultPii:false,tracesSampleRate:1,
 transport:()=>({send:envelope=>{const encoded=serializeEnvelope(envelope);envelopes.push(typeof encoded==='string'?encoded:new TextDecoder().decode(encoded));return Promise.resolve({statusCode:200});},flush:async()=>true}),
 beforeBreadcrumb:crumb=>fixed&&containsRecruitmentUrl(crumb)?null:crumb,
 beforeSend:event=>isSensitiveRecruitmentUrl(location.href)?null:fixed?scrubRecruitmentTelemetry(event):event,
 beforeSendTransaction:event=>isSensitiveRecruitmentUrl(location.href)?null:fixed?scrubRecruitmentTelemetry(event):event,
});
// Actual SDK instruments replaceState before original history update.
history.replaceState(null,'','/trainer/invite');
history.pushState(null,'','/dashboard');
Sentry.addBreadcrumb({category:'qa',message:'ordinary dashboard breadcrumb'});
Sentry.captureException(new Error('ordinary dashboard failure'));
Sentry.captureEvent({type:'transaction',transaction:'dashboard',start_timestamp:Date.now()/1000-1,timestamp:Date.now()/1000,spans:[],contexts:{trace:{trace_id:'a'.repeat(32),span_id:'b'.repeat(16),op:'navigation'}}});
Sentry.flush(5000).then(()=>{
 const payload=envelopes.join('\n');
 const result={fixed,envelopes:envelopes.length,tokenLeaked:payload.includes(token),errorPreserved:payload.includes('ordinary dashboard failure'),ordinaryBreadcrumbPreserved:payload.includes('ordinary dashboard breadcrumb'),transactionPreserved:payload.includes('"type":"transaction"')};
 window.qaResult=result;document.body.textContent=JSON.stringify(result);
});
