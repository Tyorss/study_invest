// Transform <style>{`...`}</style> to <style dangerouslySetInnerHTML={{ __html: `...` }} />
// to avoid React hydration mismatches on inline style blocks.
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "components", "value-chain");
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".jsx"));

for (const f of files) {
  const p = path.join(DIR, f);
  let src = fs.readFileSync(p, "utf8");
  const before = src;
  // Match: <style>{`...`}</style> where ... may span lines
  src = src.replace(
    /<style>\{`([\s\S]*?)`\}<\/style>/g,
    (_m, body) => `<style dangerouslySetInnerHTML={{ __html: \`${body}\` }} />`,
  );
  if (src !== before) {
    fs.writeFileSync(p, src);
    console.log(`FIXED ${f}`);
  } else {
    console.log(`skip ${f}`);
  }
}
