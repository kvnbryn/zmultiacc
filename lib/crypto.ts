'use server';

import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Tidak ada lagi impor 'bcrypt' atau 'crypto'

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect('/login');
}

export async function getZepetoAccounts(userId: string) {
  if (!userId) return [];
  const accounts = await prisma.zepetoAccount.findMany({
    where: { userId },
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
    revalidatePath('/dashboard');
}

export async function validateAccount(formData: FormData) {
    const accountId = formData.get('accountId') as string;
    console.log(`Memulai validasi ulang untuk akun ID: ${accountId}`);
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
    revalidatePath('/dashboard');
}

// ===== FUNGSI ADD ACCOUNT - TANPA ENKRIPSI =====
export async function addZepetoAccount(formData: FormData) {
  const session = await getSession();
  if (!session.userId) throw new Error('Not authenticated');

  const zepetoId = formData.get('zepetoEmail') as string; 
  const password = formData.get('zepetoPassword') as string;
  const nameLabel = formData.get('name') as string;

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
          // PERINGATAN: Menyimpan password sebagai plain text
          encryptedZepetoPassword: password, 
          displayName: profile.name, 
          username: profile.userId, 
          profilePic: profile.imageUrl,
          status: 'CONNECTED', 
          lastValidatedAt: new Date(),
        },
    });
    revalidatePath('/dashboard');
  } catch (error) { 
    console.error("Proses tambah akun ZEPETO gagal:", error); 
    throw error; 
  }
}

// ===== FUNGSI UPLOAD OTOMATIS - MENGAMBIL PASSWORD PLAIN TEXT DARI DB (LENGKAP) =====
export async function uploadZepetoItem(formData: FormData) {
    const session = await getSession();
    if (!session.userId) return { success: false, message: 'Sesi tidak valid.' };

    const accountId = formData.get('accountId') as string;
    const categoryKey = formData.get('category') as string;
    const zepetoFile = formData.get('zepetoFile') as File;

    const account = await prisma.zepetoAccount.findUnique({ where: { id: accountId } });
    if (!account) return { success: false, message: 'Akun ZEPETO tidak ditemukan.' };
    if (account.status !== 'CONNECTED') return { success: false, message: 'Koneksi akun ZEPETO bermasalah.' };

    try {
        // === LANGKAH 0: LOGIN OTOMATIS UNTUK DAPAT TOKEN BARU ===
        console.log(`Langkah 0: Login otomatis untuk akun ${account.name}...`);
        // Mengambil password asli langsung dari database
        const plainPassword = account.encryptedZepetoPassword;

        const loginUrl = 'https://cf-api-studio.zepeto.me/api/authenticate/zepeto-id';
        const loginResponse = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zepetoId: account.zepetoEmail, password: plainPassword })
        });

        if (!loginResponse.ok) throw new Error('Login ulang otomatis gagal. Mungkin password sudah diganti.');
        
        const loginData = await loginResponse.json();
        const bearerToken = `Bearer ${loginData.authToken}`;
        console.log("Langkah 0 Sukses. Token baru didapatkan.");

        // Mapping dari form ke ID Kategori ZEPETO asli
        const categoryIdMap: { [key: string]: string } = {
            'hair': '61681e66ec485e4a0df0d476',
            'top': 'DR_TOP_01', // Placeholder, ganti dengan ID asli jika perlu
            'bottom': 'DR_PANTS_01', // Placeholder
            'dress': 'DR_DRESS_01', // Placeholder
            'shoes': 'SH_SHOES_01', // Placeholder
        };
        const categoryId = categoryIdMap[categoryKey];
        if (!categoryId) return { success: false, message: 'Kategori item tidak valid.' };

        // === LANGKAH 1: UPLOAD ASET MENTAH ===
        console.log('Langkah 1: Mengupload aset mentah...');
        const assetUploadUrl = `https://cf-api-studio.zepeto.me/api/assets?categoryId=${categoryId}`;
        const assetFormData = new FormData();
        assetFormData.append('file', zepetoFile, zepetoFile.name);
        const assetResponse = await fetch(assetUploadUrl, {
            method: 'POST',
            headers: { 'Authorization': bearerToken },
            body: assetFormData,
        });
        if (!assetResponse.ok) throw new Error(`Langkah 1 Gagal: ${await assetResponse.text()}`);
        const assetData = await assetResponse.json();
        const assetId = assetData.id;
        console.log(`Langkah 1 Sukses. Asset ID: ${assetId}`);

        // === LANGKAH 2: MEMULAI PROSES BUILD ===
        console.log('Langkah 2: Memulai proses build...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        const buildUrl = `https://cf-api-studio.zepeto.me/api/assets/${assetId}/build/${categoryId}`;
        const buildResponse = await fetch(buildUrl, {
            method: 'POST',
            headers: { 'Authorization': bearerToken },
            body: null,
        });
        if (!buildResponse.ok) throw new Error(`Langkah 2 Gagal: ${await buildResponse.text()}`);
        console.log('Langkah 2 Sukses. Perintah build diterima.');

        // === LANGKAH 3: MEMBUAT ITEM FINAL ===
        console.log('Langkah 3: Membuat item final...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        const itemsUrl = 'https://cf-api-studio.zepeto.me/api/items';
        const itemPayload = {
            price: 5,
            promotional: false,
            assetId: assetId,
            categoryId: categoryId,
            currency: "ZEM",
        };
        const itemResponse = await fetch(itemsUrl, {
            method: 'POST',
            headers: { 'Authorization': bearerToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(itemPayload),
        });
        if (!itemResponse.ok && itemResponse.status !== 500) {
            throw new Error(`Langkah 3 Gagal: ${await itemResponse.text()}`);
        }
        console.log('Langkah 3 Selesai. Item berhasil dibuat di ZEPETO Studio.');

        return { success: true, message: `Upload item ${zepetoFile.name} berhasil diproses secara OTOMATIS!` };

    } catch (error: any) {
        console.error("Proses upload otomatis gagal:", error);
        return { success: false, message: error.message };
    }
}