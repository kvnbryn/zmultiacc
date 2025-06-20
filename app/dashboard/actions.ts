'use server';

import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect('/login');
}

export async function getZepetoAccounts() {
  const session = await getSession();
  if (!session.userId) return [];
  const accounts = await prisma.zepetoAccount.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  });
  return accounts;
}

export async function deleteZepetoAccount(formData: FormData) {
    const session = await getSession();
    if (!session.userId) throw new Error('Not authenticated');
    const accountId = formData.get('accountId') as string;
    await prisma.zepetoAccount.delete({
        where: { id: accountId, userId: session.userId }
    });
    revalidatePath('/dashboard/akun');
}

export async function validateAccount(formData: FormData) {
    const accountId = formData.get('accountId') as string;
    const randomSuccess = Math.random() > 0.2;
    if (randomSuccess) {
        await prisma.zepetoAccount.update({
            where: { id: accountId },
            data: { status: 'CONNECTED', lastValidatedAt: new Date() }
        });
    } else {
        await prisma.zepetoAccount.update({
            where: { id: accountId },
            data: { status: 'FAILED', lastValidatedAt: new Date() }
        });
    }
    revalidatePath('/dashboard/akun');
}

export async function addZepetoAccount(formData: FormData) {
  const session = await getSession();
  if (!session.userId) throw new Error('Not authenticated');

  const zepetoId = formData.get('zepetoEmail') as string; 
  const password = formData.get('zepetoPassword') as string;
  const nameLabel = formData.get('name') as string || 'Zepeto Account';

  try {
    const loginUrl = 'https://cf-api-studio.zepeto.me/api/authenticate/zepeto-id';
    const loginResponse = await fetch(loginUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ zepetoId: zepetoId, password: password }) 
    });
    if (!loginResponse.ok) throw new Error('Login ZEPETO gagal. Cek ID/Password.');
    
    const loginData = await loginResponse.json();
    const profile = loginData.profile;
    if (!profile) throw new Error('Data profil tidak ditemukan.');
    
    await prisma.zepetoAccount.create({
        data: {
          userId: session.userId, 
          name: nameLabel, 
          zepetoEmail: zepetoId,
          encryptedZepetoPassword: password, 
          displayName: profile.name, 
          username: profile.userId, 
          profilePic: profile.imageUrl,
          status: 'CONNECTED', 
          lastValidatedAt: new Date(),
        },
    });
    revalidatePath('/dashboard/akun');
  } catch (error) { 
    console.error("Proses tambah akun ZEPETO gagal:", error); 
    throw error; 
  }
}

export async function uploadZepetoItem(formData: FormData) {
    const session = await getSession();
    if (!session.userId) return { success: false, message: 'Sesi tidak valid.' };

    const accountId = formData.get('accountId') as string;
    const categoryKey = formData.get('category') as string;
    const zepetoFile = formData.get('zepetoFile') as File;

    if (!accountId || !categoryKey || !zepetoFile || zepetoFile.size === 0) {
        return { success: false, message: 'Harap lengkapi semua field.' };
    }

    const account = await prisma.zepetoAccount.findUnique({ where: { id: accountId } });
    if (!account) return { success: false, message: 'Akun ZEPETO tidak ditemukan.' };
    if (account.status !== 'CONNECTED') return { success: false, message: 'Koneksi akun ZEPETO bermasalah.' };

    try {
        const plainPassword = account.encryptedZepetoPassword;
        const loginUrl = 'https://cf-api-studio.zepeto.me/api/authenticate/zepeto-id';
        const loginResponse = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zepetoId: account.zepetoEmail, password: plainPassword })
        });
        if (!loginResponse.ok) throw new Error('Login ulang otomatis gagal.');
        
        const loginData = await loginResponse.json();
        const bearerToken = `Bearer ${loginData.authToken}`;
        
        const categoryIdMap: { [key: string]: string } = { 'hair': '61681e66ec485e4a0df0d476', 'top': 'DR_TOP_01', 'bottom': 'DR_PANTS_01', 'dress': 'DR_DRESS_01', 'shoes': 'SH_SHOES_01' };
        const categoryId = categoryIdMap[categoryKey];

        const assetFormData = new FormData();
        assetFormData.append('file', zepetoFile, zepetoFile.name);
        const assetResponse = await fetch(`https://cf-api-studio.zepeto.me/api/assets?categoryId=${categoryId}`, {
            method: 'POST',
            headers: { 'Authorization': bearerToken },
            body: assetFormData,
        });
        if (!assetResponse.ok) throw new Error(`Langkah 1 Gagal: Upload Aset Mentah`);
        const assetData = await assetResponse.json();
        const assetId = assetData.id;

        await new Promise(resolve => setTimeout(resolve, 2000));
        const buildResponse = await fetch(`https://cf-api-studio.zepeto.me/api/assets/${assetId}/build/${categoryId}`, {
            method: 'POST',
            headers: { 'Authorization': bearerToken },
        });
        if (!buildResponse.ok) throw new Error(`Langkah 2 Gagal: Proses Build`);

        await new Promise(resolve => setTimeout(resolve, 3000));
        const itemPayload = { price: 5, assetId: assetId, categoryId: categoryId, currency: "ZEM" };
        const itemResponse = await fetch('https://cf-api-studio.zepeto.me/api/items', {
            method: 'POST',
            headers: { 'Authorization': bearerToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(itemPayload),
        });
        if (!itemResponse.ok && itemResponse.status !== 500) throw new Error(`Langkah 3 Gagal: Membuat Item Final`);

        return { success: true, message: `Upload item ${zepetoFile.name} berhasil diproses OTOMATIS!` };
    } catch (error: unknown) {
        console.error("Proses upload otomatis gagal:", error);
        if (error instanceof Error) {
            return { success: false, message: error.message };
        }
        return { success: false, message: "Terjadi kesalahan yang tidak diketahui." };
    }
}
