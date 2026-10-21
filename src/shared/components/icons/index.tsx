import { History, Inbox, SearchX, Settings } from 'lucide-react'

export const TgysLogo = ({
  size = 36,
  className,
  ...props
}: { size?: number; className?: string } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      viewBox="210 135 600 600"
      width={size}
      height={size}
      className={`fill-foreground ${className ?? ''}`}
      {...props}
    >
      <path d="M507.68,633.76 C484.73,647.36 461.95,660.54 439.47,674.21 C405.77,694.69 366.85,674.47 360.02,637.35 C358.59,629.56 358.88,621.41 358.87,613.43 C358.79,535.94 358.82,458.45 358.81,380.96 L335.08,396.24 C333.64,395.41 329.47,392.97 326.43,391.24 C323.39,389.52 319.75,387.94 316.85,385.89 C313.94,383.83 310.95,381.56 308.99,378.91 C307.03,376.27 305.63,373.20 305.11,370.03 C304.58,366.87 305.06,363.32 305.85,359.94 C306.65,356.56 308.44,353.03 309.88,349.75 C311.32,346.48 313.32,343.32 314.49,340.29 C315.67,337.27 316.71,334.48 316.93,331.62 C317.15,328.75 316.66,326.03 315.80,323.09 C314.93,320.15 313.19,317.15 311.74,313.97 C310.30,310.79 308.28,307.37 307.13,304.00 C305.99,300.63 304.91,297.03 304.88,293.74 C304.85,290.45 305.52,287.14 306.96,284.27 C308.39,281.41 310.86,278.81 313.49,276.54 C316.12,274.28 319.65,272.48 322.74,270.67 C325.83,268.87 329.30,267.49 332.03,265.73 C334.76,263.98 337.24,262.34 339.10,260.14 C340.96,257.95 342.17,255.47 343.20,252.58 C344.23,249.69 344.58,246.24 345.28,242.82 C345.98,239.40 346.35,235.45 347.41,232.05 C348.46,228.65 349.70,225.10 351.61,222.42 C353.52,219.74 356.01,217.46 358.86,215.98 C361.71,214.51 365.23,213.86 368.69,213.57 C372.15,213.28 376.07,213.90 379.62,214.26 C383.18,214.62 386.81,215.53 390.04,215.72 C393.28,215.90 396.26,216.03 399.05,215.36 C401.85,214.68 404.28,213.38 406.81,211.64 C409.34,209.91 411.65,207.32 414.23,204.97 C416.81,202.61 419.43,199.64 422.28,197.51 C425.14,195.38 428.23,193.23 431.35,192.19 C434.46,191.14 437.82,190.76 440.99,191.24 C444.16,191.72 447.40,193.27 450.36,195.07 C453.33,196.87 456.14,199.67 458.80,202.05 C461.47,204.43 463.86,207.30 466.38,209.36 C468.89,211.41 471.22,213.26 473.88,214.36 C476.54,215.45 479.27,215.83 482.33,215.91 C485.40,216.00 488.79,215.26 492.26,214.87 C495.73,214.48 499.60,213.62 503.16,213.57 C506.72,213.53 510.48,213.61 513.62,214.60 C516.76,215.58 519.70,217.25 521.98,219.50 C524.26,221.75 525.97,224.90 527.31,228.11 C528.66,231.31 529.28,235.22 530.04,238.72 C530.80,242.21 531.04,245.94 531.87,249.08 C532.70,252.21 533.49,255.08 535.00,257.53 C536.51,259.98 538.50,261.89 540.92,263.76 C543.35,265.63 546.53,267.03 549.57,268.76 C552.61,270.48 556.25,272.06 559.15,274.11 C562.06,276.17 565.05,278.44 567.01,281.09 C568.97,283.73 570.37,286.80 570.89,289.97 C571.42,293.13 570.94,296.68 570.15,300.06 C569.35,303.44 567.56,306.97 566.12,310.25 C564.68,313.52 562.68,316.68 561.51,319.71 C560.33,322.73 559.29,325.52 559.07,328.38 C558.85,331.25 559.34,333.97 560.20,336.91 C561.07,339.85 562.81,342.85 564.26,346.03 C565.70,349.21 567.72,352.63 568.87,356.00 C570.01,359.37 571.09,362.97 571.12,366.26 C571.15,369.55 570.48,372.86 569.04,375.73 C567.61,378.59 563.92,381.92 562.51,383.46 C561.09,384.99 560.88,384.69 560.56,384.93 L522.97,368.08 C558.56,388.72 594.08,409.46 629.56,430.27 C632.57,432.04 634.59,431.86 636.80,429.09 C648.30,414.73 648.90,398.99 642.64,382.52 C638.32,371.13 631.00,361.58 622.70,352.85 C614.66,344.41 606.03,336.52 598.05,328.02 C585.53,314.69 577.30,298.85 575.01,280.73 C570.12,242.09 592.25,212.16 628.60,207.04 C658.36,202.85 686.37,220.97 692.72,247.53 C697.07,265.75 689.51,285.60 674.07,294.89 C668.75,298.09 663.07,299.70 656.93,297.34 C651.40,295.21 648.67,291.24 648.66,285.55 C648.66,279.89 651.85,274.89 656.75,272.86 C666.20,268.95 669.48,261.45 665.58,251.97 C661.48,242.01 653.41,236.55 643.27,234.60 C620.48,230.23 598.78,249.68 600.42,272.82 C601.39,286.36 608.19,297.41 616.62,307.53 C627.19,320.22 640.05,330.74 650.72,343.36 C661.68,356.32 669.94,370.51 672.50,387.54 C675.19,405.46 673.06,422.66 664.57,438.87 C664.10,439.75 663.75,440.73 663.15,441.51 C659.86,445.74 660.88,448.16 665.47,451.15 C680.28,460.80 687.63,474.77 688.43,492.57 C689.51,516.21 679.20,533.13 659.23,544.84 C617.28,569.43 575.33,594.02 533.39,618.62 C524.91,623.59 516.45,628.58 507.68,633.76 Z M460.347626,563.777466 C491.329803,545.506348 522.303040,527.220093 553.299377,508.972992 C562.997070,503.264130 567.846863,492.267609 553.259583,484.087189 C537.286926,475.129852 521.631348,465.605682 505.867279,456.278198 C487.236755,445.254669 468.640686,434.172943 450.024353,423.125366 C442.965881,418.936676 437.244385,419.829437 432.306244,425.719238 C429.411621,429.171692 429.052795,433.208099 429.064941,437.453552 C429.175415,476.103210 429.243042,514.752991 429.324554,553.402771 C429.328766,555.401794 429.251556,557.406677 429.373352,559.398926 C429.944183,568.735291 439.636353,574.788330 448.030579,570.849182 C452.082275,568.947876 455.828156,566.394897 460.347626,563.777466 M382.604462,322.942444 C379.154205,325.022614 380.347565,327.589661 381.837738,330.195618 C391.856506,347.716034 414.870605,348.753845 426.477448,332.186768 C427.582550,330.609436 429.411133,328.915131 427.968475,326.867401 C426.158936,324.298920 423.226501,323.170227 420.205353,322.920624 C417.688232,322.712677 417.841125,325.217316 417.199951,326.813263 C414.993561,332.305054 410.477692,335.451874 404.957397,335.340393 C399.569580,335.231567 395.576843,332.193909 393.484802,326.611938 C391.137695,320.349426 390.272369,320.005768 382.604462,322.942444 M455.186462,318.653137 C453.887054,319.657776 452.398804,320.482758 451.798889,322.140778 C457.540741,329.901581 468.968994,332.611389 478.714935,328.556824 C489.482147,324.077332 498.048218,311.922913 496.554047,303.189178 C496.086975,300.458984 494.741730,299.207214 491.671814,299.810669 C484.902344,301.141296 484.433289,301.568787 484.546600,308.620667 C484.646057,314.811340 481.209991,320.001129 475.826477,321.791473 C470.912933,323.425507 466.579803,321.587158 462.692596,316.246796 C462.322388,315.738159 461.836487,315.313751 461.456055,314.905762 C458.973602,315.329407 457.609924,317.201233 455.186462,318.653137 M426.121002,371.579102 C435.394989,375.140686 440.774658,369.673126 445.645508,362.752228 C451.373199,366.614838 457.179962,368.699524 463.223419,364.057098 C466.190704,361.777649 468.736755,359.110931 468.493988,354.309906 C465.864105,355.349091 463.951965,356.446594 461.904327,356.841461 C457.845154,357.624176 453.320984,358.682587 449.874573,356.005249 C446.969513,353.748505 450.176239,350.546234 450.362976,347.739960 C450.384766,347.412262 450.519897,347.090729 450.531006,346.763885 C450.589020,345.056793 449.672760,344.106079 448.074829,344.578644 C444.042267,345.771149 439.568909,345.833496 436.067108,348.789703 C436.375488,349.431427 436.500732,349.933197 436.802094,350.283447 C442.526428,356.936890 441.960205,359.379059 433.810760,363.426910 C431.074982,364.785797 428.243347,365.423370 425.173828,365.421143 C423.513245,365.419952 421.540771,364.470795 420.007904,366.483398 C420.982086,369.030243 423.258575,370.092621 426.121002,371.579102 z" />
    </svg>
  )
}

export const SearchIcon = ({
  size = 24,
  strokeWidth = 1.5,
  width,
  height,
  ...props
}: {
  size?: number
  strokeWidth?: number
  width?: number
  height?: number
}) => {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height={height || size}
      role="presentation"
      viewBox="0 0 24 24"
      width={width || size}
      {...props}
    >
      <path
        d="M11.5 21C16.7467 21 21 16.7467 21 11.5C21 6.25329 16.7467 2 11.5 2C6.25329 2 2 6.25329 2 11.5C2 16.7467 6.25329 21 11.5 21Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <path
        d="M22 22L20 20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </svg>
  )
}

export const RecentIcon = ({
  size = 36,
  className,
  ...props
}: { size?: number; className?: string } & React.SVGProps<SVGSVGElement>) => (
  <History size={size} className={className} {...props} />
)

export const SettingIcon = ({
  size = 36,
  className,
  ...props
}: { size?: number; className?: string } & React.SVGProps<SVGSVGElement>) => (
  <Settings size={size} className={className} {...props} />
)

// SettingsModal 中使用的图标
export const CheckIcon = ({
  size = 16,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export const CircleCheckIcon = ({
  size = 16,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      width={size}
      height={size}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

export const LinkIcon = ({
  size = 16,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      width={size}
      height={size}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  )
}

export const TagIcon = ({
  size = 16,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      width={size}
      height={size}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
      />
    </svg>
  )
}

export const TrashIcon = ({
  size = 16,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      width={size}
      height={size}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

export const ServerIcon = ({
  size = 24,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      width={size}
      height={size}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  )
}

export const PackageIcon = ({
  size = 24,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      width={size}
      height={size}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 17v1a3 3 0 006 0v-1m3-7V7a3 3 0 00-3-3H9a3 3 0 00-3 3v3m3 7h6a3 3 0 003-3v-1a3 3 0 00-3-3H9a3 3 0 00-3 3v1a3 3 0 003 3z"
      />
    </svg>
  )
}

export const CheckCircleIcon = ({
  size = 20,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg fill="currentColor" viewBox="0 0 20 20" width={size} height={size} {...props}>
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export const CloseIcon = ({
  size = 20,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      focusable="false"
      height={size}
      role="presentation"
      viewBox="0 0 1024 1024"
      width={size}
      {...props}
    >
      <path d="M597.795527 511.488347 813.564755 295.718095c23.833825-23.833825 23.833825-62.47489 0.001023-86.307691-23.832801-23.832801-62.47489-23.833825-86.307691 0L511.487835 425.180656 295.717583 209.410404c-23.833825-23.833825-62.475913-23.833825-86.307691 0-23.832801 23.832801-23.833825 62.47489 0 86.308715l215.769228 215.769228L209.410915 727.258599c-23.833825 23.833825-23.833825 62.47489 0 86.307691 23.832801 23.833825 62.473867 23.833825 86.307691 0l215.768205-215.768205 215.769228 215.769228c23.834848 23.833825 62.475913 23.832801 86.308715 0 23.833825-23.833825 23.833825-62.47489 0-86.307691L597.795527 511.488347z"></path>
    </svg>
  )
}

export const NoItemIcon = ({
  size = 36,
  className,
  ...props
}: { size?: number; className?: string } & React.SVGProps<SVGSVGElement>) => (
  <Inbox
    size={size}
    className={`text-muted-foreground ${className ?? ''}`}
    strokeWidth={1}
    {...props}
  />
)

export const NoResultIcon = ({
  size = 36,
  className,
  ...props
}: { size?: number; className?: string } & React.SVGProps<SVGSVGElement>) => (
  <SearchX
    size={size}
    className={`text-muted-foreground ${className ?? ''}`}
    strokeWidth={1}
    {...props}
  />
)

export const DownloadIcon = ({
  size = 16,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      width={size}
      height={size}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  )
}

export const UploadIcon = ({
  size = 16,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      width={size}
      height={size}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  )
}

export const CodeIcon = ({
  size = 16,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      width={size}
      height={size}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  )
}

export const GlobeIcon = ({
  size = 16,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      width={size}
      height={size}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

export const ArrowUpIcon = ({
  size = 16,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      width={size}
      height={size}
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  )
}

export const ArrowDownIcon = ({
  size = 16,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      width={size}
      height={size}
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export const ChevronDownIcon = ({
  size = 24,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      width={size}
      height={size}
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
    </svg>
  )
}
