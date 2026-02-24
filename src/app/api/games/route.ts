import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';

function getUserIdFromCookie(reqCookies: any): string | null {
    const token = reqCookies.get('auth_token')?.value;
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        return decoded.id;
    } catch {
        return null;
    }
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = getUserIdFromCookie(cookieStore);

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const games = await prisma.gamePack.findMany({
            where: { authorId: userId },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(games);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const userId = getUserIdFromCookie(cookieStore);

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { title, gameType, questions } = body;

        const newGame = await prisma.gamePack.create({
            data: {
                title,
                gameType,
                questions: JSON.stringify(questions),
                authorId: userId,
            }
        });

        return NextResponse.json(newGame, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create game pack' }, { status: 500 });
    }
}
