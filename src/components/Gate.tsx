import { useState, type FormEvent } from 'react';
import { Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../store/app';

type Mode = 'signin' | 'signup' | 'reset';

/** Sign-in / loading screen, shown only when Firebase is configured. */
export function Gate() {
  const auth = useApp((s) => s.auth);
  const msg = useApp((s) => s.authMessage);
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  if (auth === 'local' || auth === 'ready') return null;
  const text = auth === 'loading' ? 'Loading your streak…' : msg || 'Your routines, todos and notes, on every device. Sign in to continue.';

  const go = (m: Mode) => { setMode(m); setError(''); setInfo(''); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setInfo('');
    const c = await import('../lib/cloud');
    if (mode === 'reset') {
      const err = await c.resetPassword(email);
      if (err) setError(err); else { setInfo('Check your inbox for a link to set a new password.'); setMode('signin'); }
    } else {
      setError(mode === 'signup' ? await c.signUpWithEmail(name, email, password) : await c.signInWithEmail(email, password));
    }
    setBusy(false);
  };

  return (
    <div className="gate">
      <motion.div className="gate-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="logo"><Flame size={30} /></div>
        <h1>StreakFire</h1>
        <p role="status">{text}</p>
        {auth === 'signed-out' && (
          <>
            <button className="btn accent gate-wide" onClick={async () => (await import('../lib/cloud')).signInWithGoogle()}>Continue with Google</button>
            <div className="gate-or"><span>or use email</span></div>
            <form className="gate-form" onSubmit={submit}>
              {mode === 'signup' && <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" aria-label="Your name" />}
              <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" aria-label="Email" />
              {mode !== 'reset' && <input className="input" type="password" placeholder={mode === 'signup' ? 'Password (6+ characters)' : 'Password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} aria-label="Password" />}
              {error && <p className="gate-error" role="alert">{error}</p>}
              {info && <p className="hint" role="status">{info}</p>}
              <button className="btn primary gate-wide" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
            </form>
            <div className="gate-links">
              {mode === 'signin' && <><button className="btn sm ghost" onClick={() => go('signup')}>Create an account</button><button className="btn sm ghost" onClick={() => go('reset')}>Forgot password?</button></>}
              {mode !== 'signin' && <button className="btn sm ghost" onClick={() => go('signin')}>Back to sign in</button>}
            </div>
          </>
        )}
        {(auth === 'denied' || auth === 'error') && <button className="btn sm ghost" onClick={async () => (await import('../lib/cloud')).signOutUser()}>Use a different account</button>}
      </motion.div>
    </div>
  );
}
