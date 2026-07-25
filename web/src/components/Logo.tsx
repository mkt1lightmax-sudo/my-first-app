export default function Logo({ className = "h-7" }: { className?: string }) {
  return <img src="/logo-lightmax.png" alt="LIGHTMAX SOLAR" className={`${className} w-auto`} />;
}
