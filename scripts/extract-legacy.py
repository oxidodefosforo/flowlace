#!/usr/bin/env python3
"""One-time (repeatable) extraction of the single-file Flowlace web build into renderer modules.

    python3 scripts/extract-legacy.py path/to/alphazeta-planner.html

Writes src/renderer/styles/*.css and src/renderer/app/*.js. The JS files are consecutive slices of the
original IIFE body, cut at its own section markers, so concatenating them in name order (scripts/build-renderer.js)
reproduces the original code exactly. Later patches for the desktop app live in separate files (src/renderer/desktop)."""
import os, re, sys

src = open(sys.argv[1], encoding='utf-8').read().split('\n')
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
R = os.path.join(root, 'src', 'renderer')

def find(pred, start=0):
    for i in range(start, len(src)):
        if pred(src[i]): return i
    raise SystemExit('marker not found')

s0 = find(lambda l: l.strip() == '<style>'); s1 = find(lambda l: l.strip() == '</style>', s0)
j0 = find(lambda l: l.strip() == '<script>', s1); j1 = find(lambda l: l.strip() == '</script>', j0)
assert src[j0 + 1].strip() == '(function(){' and src[j0 + 2].strip() == "'use strict';", 'unexpected script prologue'
assert src[j1 - 1].strip() == '})();', 'unexpected script epilogue'
body_html = '\n'.join(l for l in src[s1 + 1:j0] if not l.startswith('</head') and not l.startswith('<body'))

def slices(lines, names):
    """Cut lines at '/* ---------- ' markers; names maps marker-text prefix -> module file name (new module starts there)."""
    out, cur = [], names['__start__']
    buf = []
    for l in lines:
        m = re.match(r'/\* ---------- (.*)', l)
        if m:
            for k, v in names.items():
                if k != '__start__' and m.group(1).startswith(k) and v != cur:
                    out.append((cur, buf)); cur, buf = v, []
                    break
        buf.append(l)
    out.append((cur, buf))
    return out

css_names = {'__start__': '01-base', 'shell': '02-shell', 'timeline': '03-timeline', 'tables': '04-tables', 'panel': '05-panel',
             'tasks': '06-tasks', 'settings': '07-settings-modal', 'responsive': '08-responsive', 'v4: phases': '09-phases',
             'v5: saved views': '10-views', 'v5.3': '11-brand', 'v6: Resources': '12-resources', 'Calendar': '13-calendar',
             'v15': '14-projects', 'v18: Workflow': '15-workflow'}
js_names = {'__start__': '00-constants', 'utils': '01-utils', 'data ----': '02-data', 'v3 data': '03-data-phases', 'v4 data': '04-data-views',
            'v6 data': '05-data-resources', 'UI helpers': '06-ui-helpers', 'timeline window': '07-timeline', 'Overview ----': '08-overview',
            'Project page': '09-project-page', 'saved task views': '10-task-views', 'Tasks (rendered': '11-tasks', 'side panel': '12-panel',
            'render ----': '13-render-routing', 'phase panel': '14-phase-panel', 'Settings ----': '15-settings', 'dialogs: new project': '16-dialogs',
            'app identity': '17-brand', 'Resources: planned hours': '18-resources', 'collapsible filter': '19-filters-sorting',
            'Calendar': '20-calendar', 'navigation memory': '21-navigation', 'Resources: quick task': '22-quick-task',
            'v15: project services': '23-services-rowmenu', 'v16: open a Projects': '24-row-open-table-settings',
            'normalisation (load': '25-workflow-model', 'diagram: swimlanes': '26-workflow-ui', 'Demo standards': '27-workflow-demo',
            'modal (short': '28-modal', 'events ----': '29-events', 'boot': '30-boot'}
def write(dirname, ext, parts, header):
    d = os.path.join(R, dirname); os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        if f.endswith(ext): os.remove(os.path.join(d, f))
    merged = {}
    order = []
    for name, buf in parts:
        if name not in merged: merged[name] = []; order.append(name)
        merged[name] += buf
    for name in order:
        with open(os.path.join(d, name + ext), 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(header + '\n'.join(merged[name]) + '\n')
    return order

css_parts = slices(src[s0 + 1:s1], css_names)
js_parts = slices(src[j0 + 3:j1 - 1], js_names)

css_files = write('styles', '.css', css_parts, '/* Flowlace renderer styles — extracted from the web build; edit here. */\n')
# JS: a new file starts whenever the module changes; the numeric prefix keeps the original order
# (a marker name that appears twice, such as "events", simply gives two files).
d = os.path.join(R, 'app'); os.makedirs(d, exist_ok=True)
for f in os.listdir(d):
    if f.endswith('.js'): os.remove(os.path.join(d, f))
idx = 0; prev = None; files = []
for n, b in js_parts:
    if n != prev:
        idx += 1; fname = f'{idx:02d}-{n.split("-", 1)[1]}.js'
        fname = {'28-panel.js': '28-workflow-panels.js', '29-events.js': '29-workflow-events.js'}.get(fname, fname); files.append(fname); prev = n
        fh = open(os.path.join(d, fname), 'w', encoding='utf-8', newline='\n')
        fh.write('/* Flowlace UI module (part of the renderer IIFE; concatenated in file-name order by scripts/build-renderer.js). */\n')
    fh.write('\n'.join(b) + '\n')
fh.close()
with open(os.path.join(R, 'body.html'), 'w', encoding='utf-8', newline='\n') as fh:
    fh.write(body_html.strip() + '\n')
print('css:', css_files)
print('js :', files)
