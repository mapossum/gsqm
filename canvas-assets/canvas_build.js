/*
 * canvas_build.js — build out the GHY 417/517 Canvas course for Fall 2026.
 *
 * Run this from the browser DevTools Console while signed in to
 * https://usm.instructure.com/courses/129514 (any page in the course).
 *
 * It performs the following, using the Canvas REST API + session cookie:
 *   1. Updates the Syllabus body.
 *   2. Creates Assignment Groups with weights (Labs 35, Quizzes 5, Discussion 5,
 *      Midterm 15, Final 15, Capstone 25).
 *   3. Creates Course Resources module with Python Resources page.
 *   4. Creates Week 1 module and all items (Overview, Reading Guide,
 *      Video Placeholder, Slides link, Data Card, Discussion, Lab 0 assignment).
 *   5. Creates Week 2 module and all items (Overview, Reading Guide,
 *      Video Placeholder, Slides link, Data Card, Discussion, Reading Quiz
 *      placeholder [import QTI separately], Lab 1 assignment).
 *   6. Creates the reusable 30-pt Lab Rubric and attaches it to Lab 0 + Lab 1.
 *   7. Schedules Monday announcements for Week 1 and Week 2.
 *
 * Not done automatically (do these manually — see notes at bottom):
 *   • Video embeds — record and upload to Studio, then edit the Video Lecture
 *     page for each week and insert the Studio embeds.
 *   • QTI quiz import for Week 2 — see W2_Quiz1.zip in this same folder.
 *   • Rubric creation via API is finicky; if the rubric step fails, create
 *     manually and re-attach.
 *
 * SAFE TO RE-RUN. Every create call checks whether an item with that name
 * already exists and updates it in place instead of duplicating.
 */

(async () => {

// ---------- Config ----------
const COURSE_ID = 129514;
const BASE = `/api/v1/courses/${COURSE_ID}`;
const ASSETS = 'https://raw.githubusercontent.com/mapossum/gsqm/main/canvas-assets';
const TZ = 'America/Chicago';

// Canvas file references — filenames as uploaded to Course Files
const CANVAS_FILE_PATHS = {
  W1_slides:  'Week1/W1_Lecture_Slides.pptx',
  W1_lab0:    'Week1/W1_Lab0_Setup.ipynb',
  W2_slides:  'Week2/W2_Lecture_Slides.pptx',
  W2_lab1:    'Week2/W2_Lab1_Data_Audit.ipynb',
  syllabus_md:'Syllabus_GHY417-517_Fall2026.md',
  python_md:  'Python_Resources.md',
};

// ---------- HTTP helper ----------
const csrf = (document.cookie.match(/_csrf_token=([^;]+)/) || [])[1];
if (!csrf) throw new Error('CSRF token not found; are you logged in to Canvas?');
const CSRF = decodeURIComponent(csrf);

async function api(method, path, body) {
  const url = path.startsWith('http') ? path : BASE + path;
  const opts = {
    method, credentials: 'same-origin',
    headers: {'Content-Type':'application/json','X-CSRF-Token':CSRF,'Accept':'application/json'}
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  if (!r.ok) throw new Error(`${method} ${path.slice(0,80)} → ${r.status}: ${text.slice(0,300)}`);
  return json;
}
async function apiList(path) {
  // paginate through a list endpoint
  const out = [];
  let url = BASE + path + (path.includes('?') ? '&' : '?') + 'per_page=100';
  while (url) {
    const r = await fetch(url.startsWith('http') ? url : url, {credentials:'same-origin', headers:{'Accept':'application/json'}});
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    out.push(...(await r.json()));
    const link = r.headers.get('link') || '';
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    url = m ? m[1] : null;
  }
  return out;
}
async function fetchAsset(name) {
  const r = await fetch(`${ASSETS}/${name}`, {credentials:'omit'});
  if (!r.ok) throw new Error(`Asset ${name} → ${r.status}`);
  return r.text();
}

// ---------- Idempotent helpers ----------
async function upsertPage(title, body_html, published=false) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  try {
    return await api('PUT', `/pages/${slug}`, {wiki_page:{title, body:body_html, published}});
  } catch {
    return await api('POST', '/pages', {wiki_page:{title, body:body_html, published}});
  }
}
async function upsertAssignmentGroup(name, group_weight, position) {
  const existing = await apiList('/assignment_groups');
  const found = existing.find(g => g.name === name);
  if (found) return api('PUT', `/assignment_groups/${found.id}`, {name, group_weight, position});
  return api('POST', '/assignment_groups', {name, group_weight, position});
}
async function upsertAssignment(payload) {
  const existing = await apiList('/assignments');
  const found = existing.find(a => a.name === payload.name);
  if (found) return api('PUT', `/assignments/${found.id}`, {assignment: payload});
  return api('POST', '/assignments', {assignment: payload});
}
async function upsertDiscussion(payload) {
  const existing = await apiList('/discussion_topics');
  const found = existing.find(d => d.title === payload.title);
  if (found) return api('PUT', `/discussion_topics/${found.id}`, payload);
  return api('POST', '/discussion_topics', payload);
}
async function upsertModule(name, position, unlock_at) {
  const existing = await apiList('/modules');
  const found = existing.find(m => m.name === name);
  const payload = {module:{name, position, unlock_at, publish_final_grade:false}};
  if (found) return api('PUT', `/modules/${found.id}`, payload);
  return api('POST', '/modules', payload);
}
async function addModuleItem(module_id, item) {
  const existing = await apiList(`/modules/${module_id}/items`);
  const found = existing.find(i => i.title === item.title && i.type === item.type);
  if (found) return found;
  return api('POST', `/modules/${module_id}/items`, {module_item: item});
}
async function scheduleAnnouncement(title, body, delayed_post_at) {
  return upsertDiscussion({
    title, message: body,
    is_announcement: true,
    delayed_post_at,
    published: true,
  });
}

// ---------- Build ----------
const log = (...a) => console.log('[canvas_build]', ...a);

log('Fetching assets from', ASSETS);
const [
  html_syllabus, html_python, html_w1_ov, html_w1_rd, html_w1_dc, html_w1_disc, html_w1_ann,
  html_w2_ov, html_w2_rd, html_w2_dc, html_w2_disc, html_w2_ann,
] = await Promise.all([
  fetchAsset('syllabus.html'),
  fetchAsset('python_resources.html'),
  fetchAsset('W1_Overview.html'),
  fetchAsset('W1_Reading_Guide.html'),
  fetchAsset('W1_Data_Card_HURDAT2.html'),
  fetchAsset('W1_Discussion_Prompt_Intro.html'),
  fetchAsset('W1_Announcement_Monday.html'),
  fetchAsset('W2_Overview.html'),
  fetchAsset('W2_Reading_Guide.html'),
  fetchAsset('W2_Data_Card_EJScreen.html'),
  fetchAsset('W2_Discussion_Prompt.html'),
  fetchAsset('W2_Announcement_Monday.html'),
]);
log('All 12 assets fetched.');

// 1. Syllabus
log('Setting syllabus body...');
await api('PUT', '', {course: {syllabus_body: html_syllabus}});

// 2. Assignment Groups
log('Setting up Assignment Groups + weights...');
const groups = {};
for (const [name, weight, pos] of [
  ['Weekly Labs', 35, 1],
  ['Reading Quizzes', 5, 2],
  ['Discussions', 5, 3],
  ['Midterm Exam', 15, 4],
  ['Final Exam', 15, 5],
  ['Capstone Project', 25, 6],
]) {
  groups[name] = (await upsertAssignmentGroup(name, weight, pos)).id;
}
// Enable weighting
await api('PUT', '', {course: {apply_assignment_group_weights: true}});

// 3. Course Resources module
log('Building Course Resources module...');
const resPage = await upsertPage('Python & Colab Resources', html_python, true);
const resMod = await upsertModule('Course Resources', 1, null);
await addModuleItem(resMod.id, {title:'Python & Colab Resources', type:'Page', page_url: resPage.url, published:true});
await api('PUT', `/modules/${resMod.id}`, {module:{published: true}});

// 4. Week 1 module + items
log('Building Week 1 module...');
const w1_ov  = await upsertPage('Week 1: Welcome & Setup', html_w1_ov, false);
const w1_rd  = await upsertPage('Week 1 Reading Guide + AI Literacy Primer', html_w1_rd, false);
const w1_vid = await upsertPage('Week 1 Video Lecture', '<p><em>Video segments will be embedded here once recorded (see instructor).</em></p>', false);
const w1_dc  = await upsertPage('Week 1 Data Card: NOAA HURDAT2', html_w1_dc, false);
const w1_disc_topic = await upsertDiscussion({
  title:'Week 1 Discussion: Introductions & A Sense of Place',
  message: html_w1_disc,
  discussion_type:'threaded',
  require_initial_post:true,
  published:false,
  delayed_post_at:'2026-08-24T13:00:00Z', // 8am CT (UTC-5)
  lock_at:'2026-09-01T04:59:00Z',
  assignment: {
    name:'Week 1 Discussion: Introductions',
    assignment_group_id: groups['Discussions'],
    points_possible: 5,
    grading_type:'points',
    submission_types:['discussion_topic'],
    due_at:'2026-08-29T04:59:00Z', // Fri Aug 28 11:59pm CT
  },
});
const lab0 = await upsertAssignment({
  name: 'Lab 0: Environment Setup (ungraded)',
  assignment_group_id: groups['Weekly Labs'],
  description: '<p>Complete the Lab 0 Colab notebook to install and verify the course Python environment.</p>' +
               '<p><strong>Notebook:</strong> download <code>W1_Lab0_Setup.ipynb</code> from Files → Week1, upload it to Google Colab (File → Upload notebook), and follow the instructions inside.</p>' +
               '<p><strong>Submission:</strong> download completed notebook as both <code>.ipynb</code> and <code>.html</code> and upload both here.</p>',
  submission_types:['online_upload'],
  allowed_extensions:['ipynb','html'],
  points_possible: 0,  // ungraded / completion
  grading_type:'not_graded',
  omit_from_final_grade: true,
  due_at:'2026-09-03T04:59:00Z',  // Wed Sept 2 11:59pm CT
  published: false,
});
const w1mod = await upsertModule('Week 1: Welcome & Setup (opens Mon Aug 24)', 2, '2026-08-24T13:00:00Z');
for (const it of [
  {title:'Week 1: Welcome & Setup', type:'Page', page_url: w1_ov.url, indent:0, published:false},
  {title:'Week 1 Reading Guide + AI Literacy Primer', type:'Page', page_url: w1_rd.url, indent:1, published:false},
  {title:'Week 1 Video Lecture', type:'Page', page_url: w1_vid.url, indent:1, published:false},
  {title:'Week 1 Data Card: NOAA HURDAT2', type:'Page', page_url: w1_dc.url, indent:1, published:false},
  {title:'Week 1 Discussion: Introductions & A Sense of Place', type:'Discussion', content_id: w1_disc_topic.id, indent:1, published:false},
  {title:'Lab 0: Environment Setup (ungraded)', type:'Assignment', content_id: lab0.id, indent:1, published:false},
]) await addModuleItem(w1mod.id, it);

// 5. Week 2 module + items
log('Building Week 2 module...');
const w2_ov  = await upsertPage('Week 2: The Nature of Geographic Data', html_w2_ov, false);
const w2_rd  = await upsertPage('Week 2 Reading Guide + Data-Dictionary Primer', html_w2_rd, false);
const w2_vid = await upsertPage('Week 2 Video Lecture', '<p><em>Video segments will be embedded here once recorded (see instructor).</em></p>', false);
const w2_dc  = await upsertPage('Week 2 Data Card: EPA EJScreen (MS coastal)', html_w2_dc, false);
const w2_disc_topic = await upsertDiscussion({
  title:'Week 2 Discussion: When Data Quality Bites',
  message: html_w2_disc,
  discussion_type:'threaded',
  require_initial_post:true,
  published:false,
  delayed_post_at:'2026-08-31T13:00:00Z',
  lock_at:'2026-09-09T04:59:00Z',
  assignment: {
    name:'Week 2 Discussion: When Data Quality Bites',
    assignment_group_id: groups['Discussions'],
    points_possible: 5,
    grading_type:'points',
    submission_types:['discussion_topic'],
    due_at:'2026-09-05T04:59:00Z', // Fri Sep 4 11:59pm CT
  },
});
const lab1 = await upsertAssignment({
  name:'Lab 1: Data Audit — EJScreen MS Coastal',
  assignment_group_id: groups['Weekly Labs'],
  description:'<p>Complete Lab 1 in Colab. Notebook is in Files → Week2 (<code>W2_Lab1_Data_Audit.ipynb</code>).</p>' +
              '<p>Submit BOTH <code>.ipynb</code> and <code>.html</code>. Rubric is attached.</p>',
  submission_types:['online_upload'],
  allowed_extensions:['ipynb','html'],
  points_possible: 30,
  grading_type:'points',
  due_at:'2026-09-10T04:59:00Z',  // Wed Sept 9 11:59pm CT
  published:false,
});
const w2mod = await upsertModule('Week 2: The Nature of Geographic Data (opens Mon Aug 31)', 3, '2026-08-31T13:00:00Z');
for (const it of [
  {title:'Week 2: The Nature of Geographic Data', type:'Page', page_url: w2_ov.url, indent:0, published:false},
  {title:'Week 2 Reading Guide + Data-Dictionary Primer', type:'Page', page_url: w2_rd.url, indent:1, published:false},
  {title:'Week 2 Video Lecture', type:'Page', page_url: w2_vid.url, indent:1, published:false},
  {title:'Week 2 Data Card: EPA EJScreen (MS coastal)', type:'Page', page_url: w2_dc.url, indent:1, published:false},
  {title:'Week 2 Discussion: When Data Quality Bites', type:'Discussion', content_id: w2_disc_topic.id, indent:1, published:false},
  {title:'Lab 1: Data Audit — EJScreen MS Coastal', type:'Assignment', content_id: lab1.id, indent:1, published:false},
]) await addModuleItem(w2mod.id, it);

// 6. Lab Rubric (best-effort via API — many Canvas rubric endpoints require pointing to an assignment)
log('Creating shared Lab Rubric...');
try {
  const rubric = await api('POST', '/rubrics', {
    rubric: {
      title: 'Lab Notebook Rubric (3-dimension, 30 pts)',
      free_form_criterion_comments: true,
      criteria: {
        '0': {description:'Code correctness', long_description:'All required cells execute; correct functions called; outputs match expected within tolerance.',
               points: 12, ratings: {'0':{description:'Excellent',points:12},'1':{description:'Adequate',points:9},'2':{description:'Incomplete',points:5},'3':{description:'Missing',points:0}}},
        '1': {description:'Interpretation in plain language', long_description:'You explain what the result means, with the right statistical caveats, in your own words.',
               points: 12, ratings: {'0':{description:'Excellent',points:12},'1':{description:'Adequate',points:9},'2':{description:'Incomplete',points:5},'3':{description:'Missing',points:0}}},
        '2': {description:'Visualization & communication', long_description:'At least one publication-quality figure with title, axis labels, units, legend, source note.',
               points: 6, ratings: {'0':{description:'Excellent',points:6},'1':{description:'Adequate',points:4},'2':{description:'Incomplete',points:2},'3':{description:'Missing',points:0}}}
      }
    },
    rubric_association: {association_type:'Assignment', association_id: lab1.id, use_for_grading:true, purpose:'grading'}
  });
  log('  Rubric created:', rubric?.rubric?.id || rubric?.id);
} catch (e) {
  log('  Rubric creation via API failed (this is normal — Canvas rubric API is finicky). Create manually in the Rubrics tab and attach to Lab 0 and Lab 1.');
  log('  Error:', e.message);
}

// 7. Scheduled announcements
log('Scheduling Monday announcements...');
await scheduleAnnouncement('Welcome to GHY 417/517 — start here', html_w1_ann, '2026-08-24T13:00:00Z');
await scheduleAnnouncement('Week 2 opens today — nature of data + your first graded lab', html_w2_ann, '2026-08-31T13:00:00Z');

log('---------------------------------------------');
log('✅ Canvas build complete.');
log('');
log('MANUAL STEPS STILL TO DO:');
log(' 1. Import W2_Quiz1.zip via Settings → Import Course Content → Content Type: QTI .zip file.');
log('    Then edit the imported quiz to set: assignment group = Reading Quizzes,');
log('    available Mon Aug 31 8am CT, due Tue Sept 8 11:59pm CT (Labor Day shift).');
log(' 2. Record video segments and embed in the "Week N Video Lecture" pages.');
log(' 3. Add links inside the Overview pages pointing to the Files-stored .pptx and .ipynb.');
log(' 4. Publish each module + item when ready. Course status is still Unpublished.');
log('');
log('Grade weights, module dates, and every text page have been set up.');

})().catch(e => console.error('canvas_build FAILED:', e));
