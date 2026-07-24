import { NextResponse } from "next/server";
export const apiError = (code: string, message: string, status = 400) => NextResponse.json({ code, message }, { status });
