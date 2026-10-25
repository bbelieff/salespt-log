import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

/** Reviewed legacy source positions, not dynamic render counts. Two conditional pairs collapse. */
const inventory: Array<[string,number,number]> = [
 ['app/(app)/calendar/_components/GcalConnectCard.tsx',1,1],
 ['app/(app)/contact/_components/MeetingSlotItem.tsx',1,1],
 ['app/(app)/db-sheet/_components/ContactPanel.tsx',1,1],
 ['app/(app)/db-sheet/_components/DbDetail.tsx',1,1],
 ['app/(app)/db-sheet/_components/ImportDialog.tsx',2,2],
 ['app/(app)/db-sheet/_components/ImportResultNotice.tsx',1,1],
 ['app/(app)/db-sheet/_components/SupplierFilter.tsx',1,1],
 ['app/(app)/db-sheet/page.tsx',4,4],
 ['app/(app)/db/_components/DbChannelWorkspace.tsx',1,1],
 ['app/(app)/db/_components/RowCard.tsx',2,2],
 ['app/(app)/payment/_components/ContractRow.tsx',4,4],
 ['app/(app)/payment/_components/DriveLinkBar.tsx',1,1],
 ['app/(app)/payment/_components/InstitutionWorkList.tsx',1,1],
 ['app/(app)/payment/_components/TerminationArchive.tsx',1,1],
 ['app/(app)/payment/_components/PaymentSlotForm.tsx',1,1],
 ['app/(app)/schedule/_components/MeetingResultCard.tsx',1,1],
 ['components/CompanyInfoEditor.tsx',1,0],
 ['components/auth/TrainerInvites.tsx',2,1],
 ['components/auth/CollapsibleSection.tsx',2,1],
 ['components/auth/AdminUserPicker.tsx',1,1],
 ['components/auth/AdminUserPickerSections.tsx',2,2],
 ['components/auth/ArenaSeasonGroups.tsx',1,1],
 ['components/auth/TraineeCard.tsx',1,1],
 ['components/auth/TrainerAssignCard.tsx',1,1],
 ['components/auth/TrainerCohortView.tsx',1,1],
 ['components/auth/TrainerMgmtSections.tsx',1,1],
 ['components/company-info/CompanyInfoLayoutToggle.tsx',1,1],
 ['components/dashboard/DashboardFollowUpsView.tsx',3,3],
 ['components/dashboard/FinanceSummaryBoxes.tsx',3,3],
 ['components/dashboard/expense-ledger/ExpenseCategoryPicker.tsx',1,1],
 ['components/announcements/UpdateAccordion.tsx',1,1],
 ['components/company-info/CompanyInfoHeader.tsx',0,1],
];

describe('approved disclosure migration boundary',()=>{
 it('binds the import raw-settings parent to the same controlled state as its icon',()=>{
  const source=readFileSync('app/(app)/db-sheet/_components/ImportDialog.tsx','utf8');
  expect(source).toContain('aria-expanded={rawOpen} onClick={()=>setRawOpen(!rawOpen)}');
  expect(source).toContain('<DisclosureChevron open={rawOpen} />');
 });
 it('maps exactly 46 legacy positions to 44 shared indicators without forcing alternate pairs',()=>{
  expect(inventory.reduce((sum,[,before])=>sum+before,0)).toBe(46);
  expect(inventory.reduce((sum,[,,after])=>sum+after,0)).toBe(44);
  for(const [file,,after] of inventory){
   const source=readFileSync(file,'utf8');
   expect((source.match(/<DisclosureChevron(?:\s|\/|>)/g)??[]).length,file).toBe(after);
  }
 });
 it('retains the contract selectable-navigation branch rather than treating it as a fold',()=>{
  const source=readFileSync('app/(app)/payment/_components/ContractRow.tsx','utf8');
  expect(source).toContain('selectable ? (<svg');
  expect(source).toContain('${selectable ? "-rotate-90" : ""}');
  expect(source).toContain('<DisclosureChevron open={open}');
 });
 it('limits native marker suppression to the explicit migrated summary class',()=>{
  const css=readFileSync('components/ui/disclosure-chevron.css','utf8');
  expect(css).not.toMatch(/^summary[\s:{]/m);
  expect(css).toContain('details[open]>.disclosure-summary [data-disclosure-native]');
  const header=readFileSync('components/company-info/CompanyInfoHeader.tsx','utf8');
  expect(header).toContain('const available = width - (status ? 64 : 0)');
  expect(header).toContain("mode === 'more' ? actions.slice(0, 1) : actions");
 });
});
