/** The app shell owns the single main landmark; routed pages must not nest another. */
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

function mainCount(path: string): number {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let count = 0;
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const roleMain = node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute)
        && attribute.name.getText(source) === "role" && attribute.initializer
        && ts.isStringLiteral(attribute.initializer) && attribute.initializer.text === "main");
      if (node.tagName.getText(source) === "main" || roleMain) count += 1;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return count;
}

it("provides exactly one main landmark in the shared app shell and none inside routed pages", () => {
  const app = "app/(app)";
  expect(mainCount(join(app, "layout.tsx"))).toBe(1);
  const pages = readdirSync(app, { recursive: true }).map(String).filter(path => /(^|[\\/])page\.tsx$/.test(path));
  expect(pages).toEqual(expect.arrayContaining(['dashboard/page.tsx','contact/page.tsx','calendar/page.tsx','payment/page.tsx'].map(path => path.replaceAll('/', sep))));
  const nested = pages.filter(path => mainCount(join(app, path)) > 0);
  expect(nested, "A nested main causes screen readers to announce duplicate main destinations").toEqual([]);
});
