import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, CheckCheck, Edit3, Flame, Keyboard, ListTodo, LogOut, Moon, Sun, Sunset, Timer, Trash2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../store/app';
import { useUI } from '../../store/ui';
import type { NoteCat, NoteColor, TodoPriority } from '../../lib/types';
import { fmt, fmtMins, relDay, shift, today } from '../../lib/dates';
import { CATS, COLORS, info, isDone, streak, tasksFor, todosDue } from '../../lib/domain';
import { parseQuick } from '../../lib/parse';
import { toggleRest, undoToast } from '../../lib/actions';
import { normalize, blank, uid } from '../../lib/seed';
import { askNotify, notify, notifyPermission } from '../../lib/notify';
import { cloudConfigured } from '../../lib/firebase-config';
import { PALETTES } from '../../lib/palettes';
import { Sheet } from '../Sheet';
import { Composer, TaskRow, TodoRow } from '../TaskRow';
import { Empty, PriDot, Seg, Stat } from '../ui';
import { SyncBadge } from '../SyncBadge';
import { TaskEditor } from './TaskEditor';
import { isMac } from '../../lib/nav';
import { cn } from '../../lib/cn';

export function DayDialog({ date: d }: { date: string }) {
  const data = useApp((s) => s.data);
  const ts = tasksFor(data, d), i = info(data, d), tds = todosDue(data, d), fut = d > today(), rv = data.reviews[d]?.note;
  return (
    <Sheet title={relDay(d)} sub={fmt(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}>
      <div className="acts" style={{ justifyContent: 'flex-start' }}>
        {i.rest ? <span className="tag sky"><Moon />Rest day</span> : i.total ? <span className={cn('tag num', i.complete ? 'good' : i.done ? 'warn' : 'muted')}>{i.done}/{i.total} done</span> : null}
        {data.focus[d]?.m ? <span className="tag teal num"><Timer />{fmtMins(data.focus[d].m)} focus</span> : null}
        <span className="sp" />
        <button className={cn('btn sm', !i.rest && 'ghost')} onClick={() => toggleRest(d)}><Moon size={14} />{i.rest ? 'Undo rest day' : 'Mark as rest day'}</button>
      </div>
      <Composer base={d} />
      {fut && ts.length > 0 && <p className="hint">You can tick these off on the day itself.</p>}
      {ts.length ? <ul className="list">{ts.map((t) => <TaskRow key={t.id} t={t} d={d} />)}</ul>
        : <Empty icon={CheckCheck} title="Nothing planned" compact><span>Add a task above. Add “daily” or “weekdays” to repeat it.</span></Empty>}
      {tds.length > 0 && <><div className="group-h"><ListTodo size={14} /> Todos due</div><ul className="list">{tds.map((t) => <TodoRow key={t.id} t={t} />)}</ul></>}
      {rv && <><div className="group-h"><Sunset size={14} /> Day note</div><p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--fg-2)' }}>{rv}</p></>}
    </Sheet>
  );
}

export function TodoDialog({ id }: { id?: string }) {
  const update = useApp((s) => s.update);
  const close = useUI((s) => s.close);
  const t = useApp((s) => s.data.todos.find((x) => x.id === id));
  const [title, setTitle] = useState(t?.title ?? '');
  const [details, setDetails] = useState(t?.details ?? '');
  const [deadline, setDeadline] = useState(t?.deadline ?? '');
  const [priority, setPriority] = useState<TodoPriority>(t?.priority ?? 'medium');
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const v = { title: title.trim(), details: details.trim(), deadline, priority };
    update((x) => { const k = x.todos.find((y) => y.id === id); if (k) Object.assign(k, v); else x.todos.push({ id: uid(), ...v, done: false, created: Date.now() }); });
    close(); toast(t ? 'Todo saved' : 'Todo added');
  };
  return (
    <Sheet title={t ? 'Edit todo' : 'New todo'}>
      <form onSubmit={save} className="contents" autoComplete="off">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" required maxLength={160} data-autofocus aria-label="Title" style={{ fontSize: 17, fontWeight: 600, height: 50 }} />
        <textarea className="input" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Details (optional)" aria-label="Details" style={{ minHeight: 80 }} />
        <div className="f2">
          <label className="field"><span>Deadline</span><input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
          <div className="field"><span>Quick pick</span><div className="acts" style={{ justifyContent: 'flex-start' }}>
            {([['Today', 0], ['Tomorrow', 1], ['Next week', 7]] as const).map(([l, n]) => <button key={l} type="button" className="btn sm" onClick={() => setDeadline(shift(today(), n))}>{l}</button>)}
            <button type="button" className="btn sm ghost" onClick={() => setDeadline('')}>None</button></div></div>
        </div>
        <div className="field"><span>Priority</span>
          <Seg value={priority} onChange={setPriority} options={(['low', 'medium', 'high'] as const).map((p) => ({ v: p, label: <><PriDot p={p} />{p[0].toUpperCase() + p.slice(1)}</> }))} /></div>
        <div className="acts">
          {t && <button type="button" className="btn sm danger" onClick={() => { const prev = update((x) => { x.todos = x.todos.filter((y) => y.id !== id); }); close(); undoToast('Todo deleted', prev); }}><Trash2 size={15} />Delete</button>}
          <span className="sp" /><button type="button" className="btn sm ghost" onClick={close}>Cancel</button><button className="btn accent">{t ? 'Save' : 'Add todo'}</button>
        </div>
      </form>
    </Sheet>
  );
}

export function NoteDialog({ id }: { id?: string }) {
  const update = useApp((s) => s.update);
  const close = useUI((s) => s.close);
  const n = useApp((s) => s.data.notes.find((x) => x.id === id));
  const [title, setTitle] = useState(n?.title ?? '');
  const [body, setBody] = useState(n?.body ?? '');
  const [cat, setCat] = useState<NoteCat>(n?.cat ?? 'personal');
  const [color, setColor] = useState<NoteColor>(n?.color ?? 'yellow');
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !body.trim()) return;
    const v = { title: title.trim(), body: body.trim(), cat, color, updated: Date.now() };
    update((x) => { const k = x.notes.find((y) => y.id === id); if (k) Object.assign(k, v); else x.notes.push({ id: uid(), pinned: false, ...v }); });
    close(); toast(n ? 'Note saved' : 'Note created');
  };
  return (
    <Sheet title={n ? 'Edit note' : 'New note'}>
      <form onSubmit={save} className="contents" autoComplete="off">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={120} data-autofocus aria-label="Title" style={{ fontSize: 17, fontWeight: 600, height: 50 }} />
        <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your note…" aria-label="Note" style={{ minHeight: 180 }} />
        <div className="f2">
          <label className="field"><span>Category</span><select className="input" value={cat} onChange={(e) => setCat(e.target.value as NoteCat)}>{Object.entries(CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <div className="field"><span>Colour</span><div className="swatches">{COLORS.map((c) => <label key={c} className={`c-${c}`} title={c}><input type="radio" name="color" checked={color === c} onChange={() => setColor(c)} aria-label={c} /></label>)}</div></div>
        </div>
        <div className="acts">
          {n && <button type="button" className="btn sm danger" onClick={() => { const prev = update((x) => { x.notes = x.notes.filter((y) => y.id !== id); }); close(); undoToast('Note deleted', prev); }}><Trash2 size={15} />Delete</button>}
          <span className="sp" /><button type="button" className="btn sm ghost" onClick={close}>Cancel</button><button className="btn accent">{n ? 'Save' : 'Create note'}</button>
        </div>
      </form>
    </Sheet>
  );
}

export function QuickDialog() {
  const { close, open } = useUI();
  return (
    <Sheet title="Add a task">
      <Composer base={today()} onAdded={close} autoFocus />
      <p className="hint">Examples: “Client call 3pm tomorrow”, “Gym 7am every mon wed fri”, “Submit timesheet on fri !high”.</p>
      <div className="acts" style={{ justifyContent: 'flex-start' }}>
        <button className="btn sm" onClick={() => {
          const v = (document.querySelector('[data-composer]') as HTMLInputElement | null)?.value || '';
          const p = parseQuick(v);
          open({ type: 'editor', date: p.date, preset: { title: p.title, time: p.time, priority: p.priority, kind: p.days ? 'repeat' : 'once', days: p.days || undefined } });
        }}><Edit3 size={14} />Open full editor</button>
        <button className="btn sm" onClick={() => open({ type: 'todo' })}><ListTodo size={14} />New todo instead</button>
      </div>
    </Sheet>
  );
}

export function ReviewDialog() {
  const data = useApp((s) => s.data);
  const update = useApp((s) => s.update);
  const close = useUI((s) => s.close);
  const d = today(), i = info(data, d), ts = tasksFor(data, d);
  const doneT = ts.filter((t) => isDone(data, d, t.id));
  const openOnce = ts.filter((t) => !t.routine && !isDone(data, d, t.id));
  const openR = ts.filter((t) => t.routine && !isDone(data, d, t.id));
  const tds = data.todos.filter((t) => !t.done && t.deadline === d);
  const [move, setMove] = useState<string[]>([...openOnce.map((t) => 't:' + t.id), ...tds.map((t) => 'd:' + t.id)]);
  const [note, setNote] = useState(data.reviews[d]?.note || '');
  const save = (e: FormEvent) => {
    e.preventDefault();
    const tm = shift(d, 1);
    update((x) => {
      move.forEach((k) => {
        const [kind, id] = k.split(':');
        if (kind === 't') { const t = x.tasks.find((y) => y.id === id); if (t) t.date = tm; }
        else { const t = x.todos.find((y) => y.id === id); if (t) t.deadline = tm; }
      });
      if (note.trim()) x.reviews[d] = { note: note.trim() }; else delete x.reviews[d];
    });
    close();
    toast(move.length ? `Day wrapped. ${move.length} item${move.length > 1 ? 's' : ''} moved to tomorrow.` : 'Day wrapped. See you tomorrow.');
  };
  const toggle = (k: string) => setMove(move.includes(k) ? move.filter((x) => x !== k) : [...move, k]);
  return (
    <Sheet title="Wrap up your day" sub={fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })}>
      <form onSubmit={save} className="contents">
        <div className="stat-row" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
          <Stat tone={i.complete ? 'good' : 'accent'} icon={CheckCheck} value={`${i.done}/${i.total}`} label="Tasks done" />
          <Stat tone="teal" icon={Timer} value={fmtMins(data.focus[d]?.m || 0)} label="Focus" />
          <Stat tone="bad" icon={Flame} value={streak(data)} label="Day streak" />
        </div>
        {i.complete && <div className="banner" style={{ background: 'var(--good-soft)', borderColor: 'transparent' }}><Trophy size={20} /><span><b>Goal hit.</b> Your streak is safe. Enjoy your evening.</span></div>}
        {doneT.length > 0 && <><div className="group-h" style={{ color: 'var(--good)' }}><CheckCheck size={14} /> Finished</div><p style={{ margin: 0, color: 'var(--fg-2)' }}>{doneT.map((t) => t.title).join(' · ')}</p></>}
        {(openOnce.length > 0 || tds.length > 0) && (
          <>
            <div className="group-h accent"><ArrowRight size={14} /> Move to tomorrow</div>
            <div className="sub-list">
              {openOnce.map((t) => <label key={t.id} className="sub"><input type="checkbox" checked={move.includes('t:' + t.id)} onChange={() => toggle('t:' + t.id)} style={{ accentColor: 'var(--accent)', width: 18, height: 18 }} /><span>{t.title}</span><span className="tag muted">Task</span></label>)}
              {tds.map((t) => <label key={t.id} className="sub"><input type="checkbox" checked={move.includes('d:' + t.id)} onChange={() => toggle('d:' + t.id)} style={{ accentColor: 'var(--accent)', width: 18, height: 18 }} /><span>{t.title}</span><span className="tag teal">Todo</span></label>)}
            </div>
          </>
        )}
        {openR.length > 0 && <p className="hint">Routines not done today: {openR.map((t) => t.title).join(', ')}. They'll be back on their next day.</p>}
        <label className="field"><span>How did today go?</span><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="One line for future you: wins, blockers, what to change." style={{ minHeight: 80 }} /></label>
        <div className="acts"><button type="button" className="btn sm ghost" onClick={close}>Cancel</button><button className="btn accent"><Sunset size={15} />Save &amp; wrap up</button></div>
      </form>
    </Sheet>
  );
}

export function SettingsDialog() {
  const data = useApp((s) => s.data);
  const user = useApp((s) => s.user);
  const update = useApp((s) => s.update);
  const setData = useApp((s) => s.setData);
  const close = useUI((s) => s.close);
  const open = useUI((s) => s.open);
  const [name, setName] = useState(data.name);
  const [perm, setPerm] = useState(notifyPermission());
  const [armed, setArmed] = useState(false);
  const set = (fn: Parameters<typeof update>[0]) => update(fn);
  const exportData = async () => {
    const txt = JSON.stringify(data);
    try { await navigator.clipboard.writeText(txt); toast('Backup copied. Paste it into a .json file to keep it.'); }
    catch { toast('Copy failed. Your browser blocked the clipboard.'); }
  };
  const importFile = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      try { const d = JSON.parse(String(r.result)); if (!d.routines || !d.done) throw new Error('bad'); const prev = data; setData(normalize(d)); close(); undoToast('Backup restored', prev); }
      catch { toast('That file is not a StreakFire backup'); }
    };
    r.readAsText(f);
  };
  return (
    <Sheet title="Settings">
      <label className="field"><span>Your name</span><input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => set((x) => { x.name = name.trim() || 'You'; })} /></label>
      <div className="field"><span>Account</span>
        {user ? (
          <div className="acts" style={{ justifyContent: 'flex-start' }}><SyncBadge /><span className="hint" style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{user.email}</span>
            <button className="btn sm" onClick={async () => { close(); const m = await import('../../lib/cloud'); await m.signOutUser(); }}><LogOut size={14} />Sign out</button></div>
        ) : <p className="hint">{cloudConfigured ? 'Not signed in.' : <>Saved on this device only. Add your Firebase keys (in <b>.env.local</b>, or in Vercel's Environment Variables) to get accounts and sync (see README).</>}</p>}
      </div>
      <div className="field"><span>A day counts for your streak when you finish</span>
        <Seg value={data.goal} onChange={(v) => set((x) => { x.goal = v; })} options={[{ v: 100, label: 'All tasks' }, { v: 80, label: '80%' }, { v: 60, label: '60%' }]} />
        <p className="hint">Days with no tasks and rest days never break your streak.</p></div>
      <div className="field"><span>Reminders</span>
        <div className="acts" style={{ justifyContent: 'flex-start' }}>
          <label className="btn sm" style={{ gap: 8 }}><input type="checkbox" checked={data.remind} style={{ accentColor: 'var(--accent)', width: 16, height: 16, margin: 0 }}
            onChange={async (e) => { const on = e.target.checked; set((x) => { x.remind = on; }); if (on) setPerm(await askNotify()); }} />Remind me</label>
          <label className="btn sm" style={{ gap: 6 }}>Untimed tasks at <input type="time" value={data.remindAt} onChange={(e) => set((x) => { x.remindAt = e.target.value || '09:00'; })} style={{ border: 0, background: 'transparent', fontWeight: 700 }} /></label>
          <button className="btn sm ghost" onClick={async () => { setPerm(await askNotify()); void notify('Reminders are on', 'StreakFire will nudge you when a task is due.'); }}>Send a test</button>
        </div>
        <p className="hint">{perm === 'denied' ? 'Notifications are blocked for this site. Allow them in browser settings to get pop-ups; in-app reminders still show.' : perm === 'unsupported' ? 'This browser does not support notifications; in-app reminders still show.' : 'Timed tasks remind you at their time. Reminders work while StreakFire is open or installed as an app.'}</p></div>
      <div className="field"><span>Focus session length</span>
        <Seg value={data.focusLen} onChange={(v) => set((x) => { x.focusLen = v; })} options={[15, 25, 45, 60].map((v) => ({ v, label: `${v} min` }))} /></div>
      <div className="field"><span>Colour theme</span>
        <div className="palettes" role="radiogroup" aria-label="Colour theme">
          {PALETTES.map((p) => {
            const on = (data.palette || 'indigo') === p.id;
            return (
              <button key={p.id} type="button" role="radio" aria-checked={on} className={cn('pal-opt', on && 'on')} onClick={() => set((x) => { x.palette = p.id; })}>
                <span className="sw" style={{ background: `linear-gradient(150deg, ${p.a}, ${p.b})` }}>{on && <Check size={16} strokeWidth={3} />}</span>{p.name}
              </button>
            );
          })}
        </div></div>
      <div className="field"><span>Mode</span>
        <Seg value={data.theme} onChange={(v) => set((x) => { x.theme = v; })} options={[{ v: 'system', label: 'System' }, { v: 'light', label: <><Sun size={14} />Light</> }, { v: 'dark', label: <><Moon size={14} />Dark</> }]} /></div>
      <div className="field"><span>Backup &amp; data</span>
        <div className="acts" style={{ justifyContent: 'flex-start' }}>
          <button className="btn sm" onClick={() => void exportData()}>Copy backup</button>
          <label className="btn sm">Restore from file<input type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); }} /></label>
          <button className="btn sm danger" onClick={() => {
            if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3500); return; }
            const prev = data; setData({ ...blank(data.name), theme: data.theme, palette: data.palette }); close(); undoToast('Everything erased', prev);
          }}>{armed ? 'Tap again to erase' : 'Erase everything'}</button>
        </div></div>
      <div className="acts"><button className="btn sm ghost" onClick={() => open({ type: 'shortcuts' })}><Keyboard size={15} />Keyboard shortcuts</button><span className="sp" /><button className="btn accent" onClick={() => { set((x) => { x.name = name.trim() || 'You'; }); close(); toast('Settings saved'); }}>Done</button></div>
    </Sheet>
  );
}

export function ShortcutsDialog() {
  const K = ({ k }: { k: string[] }) => <span>{k.map((x) => <kbd key={x}>{x}</kbd>)}</span>;
  const rows: [string[], string][] = [[[isMac ? '⌘' : 'Ctrl', 'K'], 'Search and commands'], [['N'], 'Add a task'], [['T'], 'New todo'], [['J'], 'New note'], [['F'], 'Start a focus session'], [['W'], 'Wrap up the day'], [['1'], 'Today'], [['2'], 'Plan'], [['3'], 'Todos'], [['4'], 'Notes'], [['5'], 'Insights'], [['?'], 'This list'], [['Esc'], 'Close']];
  return <Sheet title="Keyboard shortcuts"><div className="keys">{rows.map(([k, l]) => <div key={l} className="contents"><K k={k} /><span>{l}</span></div>)}</div></Sheet>;
}

/** Renders whichever dialog is open. */
export function Dialogs() {
  const dialog = useUI((s) => s.dialog);
  if (!dialog) return null;
  const key = JSON.stringify(dialog);
  switch (dialog.type) {
    case 'editor': return <TaskEditor key={key} id={dialog.id} date={dialog.date} preset={dialog.preset} />;
    case 'day': return <DayDialog key={key} date={dialog.date} />;
    case 'todo': return <TodoDialog key={key} id={dialog.id} />;
    case 'note': return <NoteDialog key={key} id={dialog.id} />;
    case 'settings': return <SettingsDialog />;
    case 'review': return <ReviewDialog />;
    case 'quick': return <QuickDialog />;
    case 'shortcuts': return <ShortcutsDialog />;
  }
}
