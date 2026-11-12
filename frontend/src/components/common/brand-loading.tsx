import Image from "next/image";

export function BrandLoading() {
  return (
    <div className="brand-loading" role="status" aria-label="Loading Kof’a">
      <div className="brand-loading-mark">
        <span className="brand-loading-orbit" aria-hidden="true" />
        <Image
          src="/assets/kofa-mark.svg"
          alt=""
          width={64}
          height={80}
          priority
        />
      </div>
      <span className="sr-only">Loading Kof’a</span>
    </div>
  );
}
