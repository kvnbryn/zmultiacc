'use client';

import { useState, useRef, useTransition } from 'react';
import { uploadZepetoItem } from '../actions';
import type { ZepetoAccount } from '@prisma/client';
import Link from 'next/link';

export function ZepetoUploader({ accounts }: { accounts: ZepetoAccount[] }) {
  const [status, setStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (formData: FormData) => {
    setStatus({ type: 'idle', message: '' });
    
    startTransition(async () => {
      const result = await uploadZepetoItem(formData);
      
      if (result.success) {
          setStatus({ type: 'success', message: result.message as string });
          formRef.current?.reset();
      } else {
          setStatus({ type: 'error', message: result.message as string });
      }
    });
  };

  const commonInputStyle = "w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:bg-gray-800/50 disabled:cursor-not-allowed";

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-6">
      {status.type !== 'idle' && (
         <div className={`p-3 rounded-lg text-sm ${
            status.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
            'bg-red-500/20 text-red-300 border border-red-500/30'
         }`}>
            {status.message}
         </div>
      )}
      
      <div>
        <label htmlFor="accountId" className="block text-sm font-medium text-gray-300 mb-1">1. Pilih Akun ZEPETO Tujuan</label>
        <select 
          id="accountId" 
          name="accountId" 
          required 
          disabled={accounts.length === 0 || isPending} 
          className={commonInputStyle}
        >
          {accounts.length > 0 ? (
            accounts.filter(acc => acc.status === 'CONNECTED').map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.displayName || acc.name} (@{acc.username})
              </option>
            ))
          ) : (
            <option>Tambahkan akun yang terhubung terlebih dahulu</option>
          )}
        </select>
        {accounts.length > 0 && accounts.filter(acc => acc.status === 'CONNECTED').length === 0 && (
            <p className="text-xs text-yellow-400 mt-2">
                Tidak ada akun yang berstatus &apos;Terhubung&apos;. Silakan cek koneksi di halaman <Link href="/dashboard/akun" className="underline">Manajemen Akun</Link>.
            </p>
        )}
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-1">2. Pilih Kategori Item</label>
        <select 
            id="category" 
            name="category" 
            required 
            disabled={isPending} 
            className={commonInputStyle}
        >
          <option value="top">Top (Atasan)</option>
          <option value="bottom">Bottom (Bawahan)</option>
          <option value="shoes">Shoes (Sepatu)</option>
          <option value="hair">Hair (Rambut)</option>
          <option value="dress">Dress</option>
        </select>
      </div>

      <div>
        <label htmlFor="zepetoFile" className="block text-sm font-medium text-gray-300 mb-1">3. Pilih File (.zepeto)</label>
        <input 
            type="file" 
            name="zepetoFile" 
            id="zepetoFile" 
            accept=".zepeto" 
            required 
            disabled={isPending} 
            className={`${commonInputStyle} file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-600/50 file:text-indigo-200 hover:file:bg-indigo-600/70`}
        />
      </div>

      <button 
        type="submit" 
        disabled={isPending || accounts.filter(acc => acc.status === 'CONNECTED').length === 0} 
        className="w-full py-3 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Memproses...' : 'UPLOAD SEKARANG'}
      </button>
    </form>
  );
}
