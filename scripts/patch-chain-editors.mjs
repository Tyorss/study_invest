// One-off transform: wire up persistence props (initialData, onChange) to each
// value-chain editor. Safe to rerun — idempotent via marker comment.
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "components", "value-chain");
const MARKER = "/* __PERSISTENCE_WIRED__ */";

const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".jsx"))
  .map((f) => path.join(DIR, f));

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  if (src.includes(MARKER)) {
    console.log(`SKIP ${path.basename(file)} (already wired)`);
    continue;
  }

  // 1) Replace `export default function X() {`  → `export default function X({ initialData, onChange } = {}) {`
  src = src.replace(
    /export\s+default\s+function\s+([A-Za-z0-9_]+)\s*\(\s*\)\s*{/,
    `${MARKER}\nexport default function $1({ initialData = null, onChange = null } = {}) {`,
  );

  // 2) Replace INITIAL_* useState inits
  src = src.replace(
    /const\s+\[layers[^\]]*\]\s*=\s*useState\(\s*INITIAL_LAYERS\s*\)/,
    "const [layers, setLayers] = useState(() => initialData?.layers ?? INITIAL_LAYERS)",
  );
  src = src.replace(
    /const\s+\[nodes,\s*setNodes\]\s*=\s*useState\(\s*INITIAL_NODES\s*\)/,
    "const [nodes, setNodes] = useState(() => initialData?.nodes ?? INITIAL_NODES)",
  );
  src = src.replace(
    /const\s+\[companies,\s*setCompanies\]\s*=\s*useState\(\s*INITIAL_COMPANIES\s*\)/,
    "const [companies, setCompanies] = useState(() => initialData?.companies ?? INITIAL_COMPANIES)",
  );
  src = src.replace(
    /const\s+\[edges,\s*setEdges\]\s*=\s*useState\(\s*INITIAL_EDGES\s*\)/,
    "const [edges, setEdges] = useState(() => initialData?.edges ?? INITIAL_EDGES)",
  );

  // 3) Insert notify effect right after the state inits. Find the 4th useState of the block.
  //    We search for the edges useState line and insert after it.
  const edgesIdx = src.indexOf("const [edges, setEdges]");
  if (edgesIdx === -1) {
    console.log(`WARN ${path.basename(file)} edges state not found`);
    continue;
  }
  const eol = src.indexOf("\n", edgesIdx);
  const notifyEffect = `

  // Persistence: notify parent on any state change (debounced externally).
  useEffect(() => {
    if (!onChange) return;
    onChange({ layers, nodes, edges, companies });
  }, [layers, nodes, edges, companies, onChange]);
`;
  src = src.slice(0, eol + 1) + notifyEffect + src.slice(eol + 1);

  fs.writeFileSync(file, src);
  console.log(`DONE ${path.basename(file)}`);
}
