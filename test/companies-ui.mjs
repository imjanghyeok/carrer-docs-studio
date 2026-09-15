import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=await fs.mkdtemp(path.join(os.tmpdir(),'career-company-ui-')),port=4323,url=`http://127.0.0.1:${port}`;
const fixture=path.join(root,'test/mock-codex.mjs');await fs.chmod(fixture,0o755);
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),STUDIO_DATA:data,STUDIO_CODEX_BIN:fixture},stdio:['ignore','pipe','pipe']});
let stderr='';server.stderr.on('data',x=>stderr+=x);await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',()=>reject(Error(stderr)));});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/api/ai/request'))requests.push(r.postDataJSON());});
await fs.mkdir(path.join(root,'.test-data'),{recursive:true});
try{
 await page.goto(url);const frame=page.frameLocator('iframe');await frame.locator('h1').first().waitFor();
 const heading=await frame.locator('h1').first().innerText();
 await page.getByRole('button',{name:'회사별 자료',exact:true}).click();const dialog=page.getByRole('dialog',{name:'회사별 자료'});
 await dialog.getByLabel('회사명',{exact:true}).fill('샘플 회사 A');await dialog.getByLabel('지원 직무').fill('백엔드 개발');await dialog.getByRole('button',{name:'회사 추가',exact:true}).click();await dialog.getByRole('heading',{name:'샘플 회사 A',exact:false}).waitFor();
 await dialog.getByText('채용 공고 붙여넣기',{exact:true}).click();await dialog.getByLabel('공고 본문',{exact:true}).fill('Backend role: SQL, testing, operational ownership.');await dialog.getByRole('button',{name:'공고 보관',exact:true}).click();await dialog.getByText('채용 공고.md',{exact:true}).waitFor();
 const folder=path.join(data,'synthetic-input');await fs.mkdir(path.join(folder,'resume'),{recursive:true});await fs.mkdir(path.join(folder,'portfolio'),{recursive:true});
 await fs.writeFile(path.join(folder,'resume','resume.md'),'Sample contributor. Implemented tests in a team of four.');await fs.writeFile(path.join(folder,'portfolio','portfolio.html'),'<html><body><h1>Sample case</h1><p>Built a prototype.</p><script>ignored script</script></body></html>');
 await dialog.getByLabel('회사 자료 폴더',{exact:true}).setInputFiles(folder);assert.equal(await dialog.getByLabel('resume.md 자료 종류').inputValue(),'resume');assert.equal(await dialog.getByLabel('portfolio.html 자료 종류').inputValue(),'portfolio');
 await dialog.getByRole('button',{name:'선택 파일 보관',exact:true}).click();await dialog.getByLabel('portfolio.html 피드백에 포함').waitFor();
 const pdfPage=await browser.newPage();await pdfPage.setContent('<html><body><h1>Sample PDF resume</h1><p>Tested a backend service.</p></body></html>');const pdf=await pdfPage.pdf({format:'A4'});await pdfPage.setContent('<html><body><div style="width:100px;height:100px;background:#888"></div></body></html>');const emptyPdf=await pdfPage.pdf({format:'A4'});await pdfPage.close();
 await dialog.getByLabel('회사 자료 파일',{exact:true}).setInputFiles([{name:'resume.pdf',mimeType:'application/pdf',buffer:pdf},{name:'scan.pdf',mimeType:'application/pdf',buffer:emptyPdf}]);await dialog.getByRole('button',{name:'선택 파일 보관',exact:true}).click();await dialog.getByLabel('scan.pdf 피드백에 포함').waitFor();assert.equal(await dialog.getByLabel('scan.pdf 피드백에 포함').isDisabled(),true);
 await dialog.locator('.company-material').filter({hasText:'resume.pdf'}).getByRole('button',{name:'내용 확인'}).click();await dialog.locator('pre').filter({hasText:'Sample PDF resume'}).waitFor();
 await dialog.getByRole('button',{name:'현재 문서 보관',exact:true}).click();await dialog.getByText('현재 문서를 HTML 사본으로 보관했습니다.',{exact:false}).waitFor();
 await dialog.getByLabel('resume.pdf 피드백에 포함').uncheck();
 const checked=await dialog.locator('.company-material input:checked').count();assert.equal(checked,4);
 await page.screenshot({path:path.join(root,'.test-data/companies.png')});
 await dialog.getByRole('button',{name:'냉정한 피드백',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.waitForFunction(()=>document.querySelector('[aria-label="Codex 요청"]').value.includes('가장 먼저 고칠 문제 3개'),{},{timeout:5000});
 assert.equal(requests.length,0);assert.match(await page.getByLabel('Codex 요청',{exact:true}).inputValue(),/가장 먼저 고칠 문제 3개/);assert.equal(await page.getByLabel('AI 요청 범위').inputValue(),'materials');assert.equal(await page.getByLabel('AI 동작').isDisabled(),true);assert.equal(await page.getByLabel('요청문과 선택 범위를 OpenAI로 전송하는 데 동의').isChecked(),false);
 assert.equal(await page.locator('.ai-references').getByText('resume.pdf',{exact:false}).count(),0);
 await page.getByRole('button',{name:'Codex 연결',exact:true}).click();await page.getByLabel('Codex 모델').waitFor();await page.getByLabel('요청문과 선택 범위를 OpenAI로 전송하는 데 동의').check();await page.getByRole('button',{name:'보내기',exact:true}).click();await page.getByText('샘플 문구에 대한 답변입니다.',{exact:true}).waitFor();
 assert.equal(requests.length,1);assert.equal(requests[0].references.materialIds.length,4);assert.equal(requests[0].includeHistory,false);assert.equal(requests[0].mode,'ask');assert.equal(await frame.locator('h1').first().innerText(),heading);assert.equal(await page.getByRole('button',{name:'검토 후 적용',exact:true}).count(),0);
 await page.setViewportSize({width:1100,height:800});await page.screenshot({path:path.join(root,'.test-data/company-feedback.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const config=await (await page.request.get(url+'/api/config')).json();assert.equal((await page.request.get(url+'/api/companies')).status(),403);
 const headers={'X-Studio-Token':config.token};const list=await (await page.request.get(url+'/api/companies',{headers})).json();assert.equal(list[0].count,6);
 await page.reload();await frame.locator('h1').first().waitFor();await page.getByRole('button',{name:'회사별 자료',exact:true}).click();await dialog.getByRole('button',{name:/샘플 회사 A/}).click();await dialog.getByText('resume.pdf',{exact:true}).waitFor();assert.equal(await dialog.locator('.company-material input:checked').count(),0);
 await page.screenshot({path:path.join(root,'.test-data/companies-compact.png')});assert.deepEqual(errors,[]);
 console.log('PASS: company/folder/file import, PDF extraction/no-text warning, saved HTML snapshot, review preset, consent, checked-only mock AI request, unchanged document, token protection and persistence');
}catch(e){await page.screenshot({path:path.join(root,'.test-data/companies-failure.png')});console.error(errors,stderr);throw e;}
finally{await browser.close();server.kill('SIGTERM');}
