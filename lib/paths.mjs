import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

export function defaultDataDirectory(env=process.env,platform=process.platform,home=os.homedir()) {
  if(env.STUDIO_DATA)return path.resolve(env.STUDIO_DATA);
  if(platform==='darwin')return path.join(home,'Library','Application Support','Career Studio');
  if(platform==='win32')return path.join(env.LOCALAPPDATA||path.join(home,'AppData','Local'),'Career Studio');
  return path.join(env.XDG_DATA_HOME||path.join(home,'.local','share'),'career-studio');
}

// Both lexical traversal and symlink escapes are rejected before serving assets.
export async function containedFile(directory,relative) {
  const base=await fs.realpath(directory);
  const file=path.resolve(base,relative);
  if(!file.startsWith(base+path.sep))throw Object.assign(Error('허용되지 않은 경로입니다.'),{status:403});
  const resolved=await fs.realpath(file);
  if(!resolved.startsWith(base+path.sep))throw Object.assign(Error('허용되지 않은 경로입니다.'),{status:403});
  return resolved;
}
