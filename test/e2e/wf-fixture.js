'use strict';
/* Shared fixture: the HTML export with its workflow tasks removed and a Schematic standard by specialty,
   with a requirement from Fee ("Send architectural layouts and lighting brief…") shown as a reference. */
const path = require('path');
const fs = require('fs');
module.exports = function makeFixture(dir) {
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
  d.workflowDraft = null;
  const f = path.join(dir, 'layout-fixture.json');
  fs.writeFileSync(f, JSON.stringify(src, null, 2));
  return { file: f, data: d };
};
