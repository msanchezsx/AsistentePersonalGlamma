import Image from "next/image";

/** Logo de Productos Glama (negro; se invierte en modo oscuro). 339×258 px. */
export function GlamaLogo({ className = "w-24", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/glama-logo.png"
      alt="Productos Glama, S.A. de C.V."
      width={339}
      height={258}
      priority={priority}
      className={`h-auto dark:invert ${className}`}
    />
  );
}
