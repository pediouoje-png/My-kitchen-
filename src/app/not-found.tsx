import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-[16px] font-semibold">페이지를 찾을 수 없어요</p>
      <p className="mt-1.5 text-[14px] text-sub">주소가 바뀌었거나 삭제된 페이지예요.</p>
      <Link href="/" className="mt-5 font-semibold text-green">
        홈으로 가기
      </Link>
    </main>
  );
}
