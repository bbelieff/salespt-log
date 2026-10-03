// Reuse established catalog/ledger security checks. Never repair pre-existing objects or ACLs.
import { inspectState as inspectBase, inspectRelation, assertRelation as assertBase, MigrationGateError } from "./weekly-goals-migrate-catalog.mjs";
export { inspectRelation, MigrationGateError, formatMigrationFailure } from "./weekly-goals-migrate-catalog.mjs";
export const TARGETS=["trainer_qualifications","trainer_invitations"];
const time=(name,required=false,def=null)=>[name,"timestamp with time zone",required,def];
const text=(name,required=true,def=null)=>[name,"text",required,def];
const columns={
 trainer_qualifications:[text("email"),text("name"),text("status"),text("department",true,"'T'::text"),text("updated_by"),time("updated_at",true,"now()")],
 trainer_invitations:[["id","uuid",true,null],text("token_hash"),text("recipient_email"),text("created_by"),time("created_at",true,"now()"),time("expires_at",true),time("accepted_at"),text("accepted_by",false),time("revoked_at"),text("revoked_by",false)],
};
const constraints={
 trainer_qualifications:["CHECK ((department = ANY (ARRAY['T'::text, '관리'::text])))","CHECK ((email = lower(btrim(email))))","CHECK (((length(name) >= 1) AND (length(name) <= 100)))","PRIMARY KEY (email)","CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text, 'revoked'::text, 'cancelled'::text])))"],
 trainer_invitations:["CHECK (((accepted_at IS NULL) = (accepted_by IS NULL)))","CHECK (((revoked_at IS NULL) = (revoked_by IS NULL)))","PRIMARY KEY (id)","CHECK ((recipient_email = lower(btrim(recipient_email))))","CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text))","UNIQUE (token_hash)"],
};
const fail=code=>{throw new MigrationGateError(code);};
export function assertRelation(name,r) {
 if(name==="schema_migrations")return assertBase(name,r);
 if(!r || r.relkind!=="r" || r.triggers || r.rules || r.inheritance)fail("CONFLICTING_RELATION");
 if(r.indexes!==(name==="trainer_invitations"?2:1) || r.valid_primary_indexes!==1)fail("CONFLICTING_INDEXES");
 if(JSON.stringify(r.columns.map(c=>[c.name,c.type,c.required,c.default_value]))!==JSON.stringify(columns[name]) || r.columns.some(c=>c.identity||c.generated))fail("CONFLICTING_COLUMNS");
 if(JSON.stringify(r.constraints.map(c=>c.definition).sort())!==JSON.stringify([...constraints[name]].sort()) || r.constraints.some(c=>!c.validated))fail("CONFLICTING_CONSTRAINTS");
 if(!r.rls || r.policies || r.unexpected_acl || r.columns.some(c=>c.column_acl) || r.browser.some(r=>r.access))fail("UNSAFE_TABLE_SECURITY");
 if(!r.server_rls_bypass || !r.server_dml)fail("SERVER_CONNECTION_CANNOT_STORE");
}
export async function inspectState(client) {
 const base=await inspectBase(client);
 const targets={};
 for(const name of TARGETS)targets[name]=await inspectRelation(client,name);
 return {...base,targets};
}
