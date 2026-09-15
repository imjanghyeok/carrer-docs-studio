import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync,execFileSync} from 'node:child_process';

test('local planning notes are excluded but force-added notes block publication',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'career-public-check-'));
 await fs.mkdir(path.join(root,'scripts'));await fs.mkdir(path.join(root,'.local'));
 await fs.copyFile(new URL('../scripts/check-public.mjs',import.meta.url),path.join(root,'scripts/check-public.mjs'));
 await fs.writeFile(path.join(root,'PUBLIC_FILES.json'),JSON.stringify(['PUBLIC_FILES.json','.gitignore','scripts/check-public.mjs']));
 await fs.writeFile(path.join(root,'.gitignore'),'.local/\n');
 await fs.writeFile(path.join(root,'.local/issue.md'),'Synthetic local draft');
 const run=()=>spawnSync(process.execPath,['scripts/check-public.mjs'],{cwd:root,encoding:'utf8'});
 execFileSync('git',['init','-q'],{cwd:root});
 assert.equal(run().status,0);
 execFileSync('git',['add','-f','.local/issue.md'],{cwd:root});
 const blocked=run();assert.equal(blocked.status,1);assert.match(blocked.stderr,/tracked outside public allowlist/);
 assert.doesNotMatch(blocked.stderr,/Synthetic local draft/);
});
