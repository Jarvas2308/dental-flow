import { cn } from "@/lib/utils";

// Monograma central da logo (LOGO/ANNA JULIA LEDUC LOGO5.pdf), recortado sem o
// anel de texto: abaixo de ~64px o anel vira borrão. A assinatura ao lado faz
// o papel dele.
export const MARK_SRC = "/brand/mark.png";

export function BrandMark({
  src = MARK_SRC,
  size = 38,
  className,
}: {
  src?: string;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt="Anna Julia Leduc"
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size, filter: "var(--mark-filter)" }}
    />
  );
}

export function BrandSignature({ className }: { className?: string }) {
  return (
    <div className={cn("leading-none", className)}>
      <div className="font-brand text-[17px] font-semibold whitespace-nowrap tracking-[0.01em]">
        Anna Julia Leduc
      </div>
      <div className="mt-[3px] text-[8.5px] font-semibold uppercase tracking-[0.19em] text-muted-foreground">
        Cirurgiã&#8209;Dentista
      </div>
    </div>
  );
}
