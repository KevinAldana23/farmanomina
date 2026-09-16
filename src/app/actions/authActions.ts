'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export interface LoginResult {
  error?: string;
  success?: boolean;
}

export async function loginAction(
  prevState: LoginResult | null,
  formData: FormData
): Promise<LoginResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Por favor, ingresa el correo y la contraseña.' };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { error: 'Credenciales inválidas. Verifica tu correo y contraseña.' };
    }

    const passwordsMatch = await bcrypt.compare(password, user.password);
    if (!passwordsMatch) {
      return { error: 'Credenciales inválidas. Verifica tu correo y contraseña.' };
    }

    const token = await signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 días
      path: '/',
    });
  } catch (error) {
    console.error('Login error:', error);
    return { error: 'Ocurrió un error inesperado al iniciar sesión.' };
  }

  redirect('/');
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect('/login');
}
