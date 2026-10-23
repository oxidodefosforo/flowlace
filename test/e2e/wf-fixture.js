'use strict';
/* Shared fixture: the HTML export with its workflow tasks removed and a Schematic standard by specialty,
   with a requirement from Fee ("Send architectural layouts and lighting brief…") shown as a reference. */
const path = require('path');
const fs = require('fs');
module.exports = function makeFixture(dir, opts = {}) {
  const src = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'web-export.json'), 'utf8'));
  const d = src.data;
  const wfTasks = new Set(d.tasks.filter(t => t.wfStepId).map(t => t.id));
  d.tasks = d.tasks.filter(t => !wfTasks.has(t.id));
  d.deliverables.forEach(x => { x.reqTaskIds = (x.reqTaskIds || []).filter(id => !wfTasks.has(id)); });
  d.projects.forEach(p => { delete p.wfScope; delete p.wfDecide; delete p.wfVersion; });
  const E = 'sv-electrical', M = 'sv-mechanical', Hy = 'sv-hydraulics', C = 'sv-coordination';
  let o = 0; const st = (id, ph, sv, cat, name, deps, roleIds, desc) => ({ id, phaseId: ph, serviceId: sv, cat, name, desc: desc || '', deps, order: o++, retired: false, createdAt: null, roleIds });
  d.workflow = { version: 1, appliedAt: '2026-10-01T00:00:00.000Z', demo: false, schema: 2, demoV2: true, steps: [
    st('fee-co-out', 'ph-fee', C, 'output', 'Send architectural layouts and lighting brief to services', [], ['ro-bimc'], 'Layouts and the lighting brief issued to every service.'),
    st('co-in1', 'ph-sd', C, 'input', 'Architectural background', ['fee-co-out'], ['ro-bimc'], 'Background drawings received from the architect.'),
    st('el-ac1', 'ph-sd', E, 'action', 'Preliminary design sketches and notes', ['co-in1'], ['ro-eng']),
    st('el-ac2', 'ph-sd', E, 'action', 'Maximum demand calculation', ['el-ac1', 'me-out1'], ['ro-eng']),
    st('el-out1', 'ph-sd', E, 'output', 'Electrical schematic report', ['el-ac2'], ['ro-seng', 'ro-qa']),
    st('me-in1', 'ph-sd', M, 'input', 'Mechanical brief', [], ['ro-eng']),
    st('me-out1', 'ph-sd', M, 'action', 'Preliminary equipment load', ['me-in1'], ['ro-eng'], 'Electrical loads of the mechanical plant.'),
    st('me-ac2', 'ph-sd', M, 'action', 'Mechanical schematic layout', ['me-out1'], ['ro-bimm', 'ro-dft']),
    st('me-out2', 'ph-sd', M, 'output', 'Mechanical schematic report', ['me-ac2'], ['ro-seng']),
    st('hy-ac1', 'ph-sd', Hy, 'action', 'Hydraulic schematic design', ['co-in1'], ['ro-bimm', 'ro-dft']),
    st('hy-out1', 'ph-sd', Hy, 'output', 'Hydraulic schematic report', ['hy-ac1'], ['ro-seng']),
    st('co-ac1', 'ph-sd', C, 'output', 'Services coordination report', ['el-out1', 'me-out2', 'hy-out1'], ['ro-bimc'])] };
  if (opts.fine) {   // several arrows arriving at one activity, as in the screenshot of the request
    d.workflow.steps.splice(4, 0, st('el-ac3', 'ph-sd', E, 'action', 'Prepare preliminary drawings', ['el-ac1', 'me-out1', 'co-in1'], ['ro-dft'], 'Preliminary electrical drawings.'));
    d.workflow.steps.find(s => s.id === 'el-out1').deps.push('el-ac3');
    d.workflow.steps.forEach((s, i) => { s.order = i; });
  }
  if (opts.types) {   // v1.6: activity types, a Decision and a QA with Yes / No outlets, documents, and the A / B / C case
    const add = (...a) => d.workflow.steps.push(st(...a)), last = () => d.workflow.steps[d.workflow.steps.length - 1];
    add('el-dec', 'ph-sd', E, 'action', 'Emergency power check', ['el-ac1'], ['ro-eng']); Object.assign(last(), { type: 'decision', question: 'Is emergency power needed?', branches: { yes: 'el-yes', no: 'el-no' } });
    add('el-yes', 'ph-sd', E, 'action', 'Size emergency power supply', ['el-dec'], ['ro-eng']);
    add('el-no', 'ph-sd', E, 'action', 'Continue with normal supply', ['el-dec'], ['ro-eng']);
    add('el-join', 'ph-sd', E, 'action', 'Update single line diagram', ['el-yes', 'el-no'], ['ro-dft']);
    add('co-qa', 'ph-sd', C, 'action', 'Drawing package review', ['co-in1'], ['ro-qa']); Object.assign(last(), { type: 'qa', question: 'QA: Is the drawing package approved?', desc: 'Criteria: title blocks, revisions, clashes closed.', branches: { yes: 'co-issue', no: 'co-fix' } });
    add('co-issue', 'ph-sd', C, 'output', 'Prepare package issue', ['co-qa'], ['ro-bimc']);
    add('co-fix', 'ph-sd', C, 'action', 'Correct review comments', ['co-qa'], ['ro-dft']);
    add('me-a', 'ph-sd', M, 'action', 'Define System Type', ['me-in1'], ['ro-eng']);
    add('me-b', 'ph-sd', M, 'action', 'Define Fan and Roof Cowl', ['me-in1'], ['ro-eng']);
    add('me-c', 'ph-sd', M, 'action', 'QA Sketches', ['me-a', 'me-b'], ['ro-qa']);
    add('fi-ac1', 'ph-sd', 'sv-fire', 'action', 'Fire services layout', ['co-in1'], ['ro-eng']);
    d.workflow.steps.find(x => x.id === 'co-in1').type = 'document';
    d.workflow.steps.forEach((x, i) => { x.order = i; });
  }
  if (opts.phases) {   // the flow continues in Design Development and Tender Issue (for All phases)
    d.workflow.steps.push(
      st('co-dd-in1', 'ph-dd', C, 'input', 'Coordinated architectural model', ['co-ac1'], ['ro-bimc']),
      st('el-dd-ac1', 'ph-dd', E, 'action', 'Detailed lighting design', ['co-dd-in1', 'el-out1'], ['ro-eng']),
      st('me-dd-ac1', 'ph-dd', M, 'action', 'Duct and pipe sizing', ['me-out2'], ['ro-eng']),
      st('el-dd-out1', 'ph-dd', E, 'output', 'Electrical DD report', ['el-dd-ac1'], ['ro-seng']),
      st('co-dd-out1', 'ph-dd', C, 'output', 'DD coordination report', ['el-dd-out1', 'me-dd-ac1'], ['ro-bimc']),
      st('co-ti-out1', 'ph-ti', C, 'output', 'Tender documentation', ['co-dd-out1'], ['ro-bimc']));
  }
  d.workflowDraft = null;
  const f = path.join(dir, 'layout-fixture.json');
  fs.writeFileSync(f, JSON.stringify(src, null, 2));
  return { file: f, data: d };
};
