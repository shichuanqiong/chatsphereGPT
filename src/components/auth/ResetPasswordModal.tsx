import React, { useEffect, useRef, useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/firebase';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ResetPasswordModal({ open, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setEmail('');
      setMessage(null);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || loading) return;

    try {
      setLoading(true);
      setMessage(null);
      await sendPasswordResetEmail(auth, email);
      setMessage({ type: 'success', text: 'Password reset email sent. Please check your inbox.' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('[reset-password]', err);
      setMessage({
        type: 'error',
        text: err?.message || 'Failed to send password reset email.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-[92%] max-w-sm rounded-2xl bg-neutral-900 text-neutral-200 shadow-xl ring-1 ring-white/10">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">Reset password</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Enter your email to receive a reset link.
          </p>
        </div>

        <form className="px-5 pt-4 pb-5 space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm text-neutral-300 mb-1">Email</label>
          <input
            ref={inputRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            inputMode="email"
            autoCapitalize="none"
            disabled={loading}
            className="w-full rounded-xl bg-neutral-800 text-neutral-100 placeholder:text-neutral-500 border border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
            placeholder="you@example.com"
          />

          {message && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                message.type === 'success'
                  ? 'bg-green-900/30 text-green-300 border border-green-500/30'
                  : 'bg-red-900/30 text-red-300 border border-red-500/30'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 h-11 rounded-xl bg-neutral-800 text-neutral-200 border border-white/10 hover:bg-neutral-800/80 active:bg-neutral-800/60 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !email}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-medium disabled:opacity-60 hover:from-cyan-300 hover:to-blue-400 active:from-cyan-500 active:to-blue-600"
            >
              {loading ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
