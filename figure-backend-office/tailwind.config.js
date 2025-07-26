/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      // === 핵심 색상 시스템 (shadcn/ui 호환성 유지) ===
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // === 완전한 브랜드 색상 시스템 ===
        // Figure 메인 브랜드 색상 (완전한 스케일)
        figure: {
          50: "hsl(var(--figure-50))",
          100: "hsl(var(--figure-100))",
          200: "hsl(var(--figure-200))",
          300: "hsl(var(--figure-300))",
          400: "hsl(var(--figure-400))",
          500: "hsl(var(--figure-500))", // Primary brand
          600: "hsl(var(--figure-600))",
          700: "hsl(var(--figure-700))",
          800: "hsl(var(--figure-800))",
          900: "hsl(var(--figure-900))",
          950: "hsl(var(--figure-950))",
        },

        // === 완전한 상태 색상 시스템 ===
        // Success (Green) - 완전한 스케일
        success: {
          50: "hsl(var(--success-50))",
          100: "hsl(var(--success-100))",
          200: "hsl(var(--success-200))",
          300: "hsl(var(--success-300))",
          400: "hsl(var(--success-400))",
          500: "hsl(var(--success-500))",
          600: "hsl(var(--success-600))",
          700: "hsl(var(--success-700))",
          800: "hsl(var(--success-800))",
          900: "hsl(var(--success-900))",
          950: "hsl(var(--success-950))",
        },

        // Warning (Amber) - 완전한 스케일
        warning: {
          50: "hsl(var(--warning-50))",
          100: "hsl(var(--warning-100))",
          200: "hsl(var(--warning-200))",
          300: "hsl(var(--warning-300))",
          400: "hsl(var(--warning-400))",
          500: "hsl(var(--warning-500))",
          600: "hsl(var(--warning-600))",
          700: "hsl(var(--warning-700))",
          800: "hsl(var(--warning-800))",
          900: "hsl(var(--warning-900))",
          950: "hsl(var(--warning-950))",
        },

        // Error (Red) - 완전한 스케일
        error: {
          50: "hsl(var(--error-50))",
          100: "hsl(var(--error-100))",
          200: "hsl(var(--error-200))",
          300: "hsl(var(--error-300))",
          400: "hsl(var(--error-400))",
          500: "hsl(var(--error-500))",
          600: "hsl(var(--error-600))",
          700: "hsl(var(--error-700))",
          800: "hsl(var(--error-800))",
          900: "hsl(var(--error-900))",
          950: "hsl(var(--error-950))",
        },

        // Info (Blue) - 완전한 스케일
        info: {
          50: "hsl(var(--info-50))",
          100: "hsl(var(--info-100))",
          200: "hsl(var(--info-200))",
          300: "hsl(var(--info-300))",
          400: "hsl(var(--info-400))",
          500: "hsl(var(--info-500))",
          600: "hsl(var(--info-600))",
          700: "hsl(var(--info-700))",
          800: "hsl(var(--info-800))",
          900: "hsl(var(--info-900))",
          950: "hsl(var(--info-950))",
        },

        // === 보조 브랜드 색상 시스템 ===
        // Purple - 보조 브랜드 색상
        purple: {
          50: "hsl(var(--purple-50))",
          100: "hsl(var(--purple-100))",
          200: "hsl(var(--purple-200))",
          300: "hsl(var(--purple-300))",
          400: "hsl(var(--purple-400))",
          500: "hsl(var(--purple-500))",
          600: "hsl(var(--purple-600))",
          700: "hsl(var(--purple-700))",
          800: "hsl(var(--purple-800))",
          900: "hsl(var(--purple-900))",
          950: "hsl(var(--purple-950))",
        },

        // Teal - 보조 브랜드 색상
        teal: {
          50: "hsl(var(--teal-50))",
          100: "hsl(var(--teal-100))",
          200: "hsl(var(--teal-200))",
          300: "hsl(var(--teal-300))",
          400: "hsl(var(--teal-400))",
          500: "hsl(var(--teal-500))",
          600: "hsl(var(--teal-600))",
          700: "hsl(var(--teal-700))",
          800: "hsl(var(--teal-800))",
          900: "hsl(var(--teal-900))",
          950: "hsl(var(--teal-950))",
        },

        // === 완전한 그레이 스케일 ===
        gray: {
          25: "hsl(var(--gray-25))",
          50: "hsl(var(--gray-50))",
          100: "hsl(var(--gray-100))",
          200: "hsl(var(--gray-200))",
          300: "hsl(var(--gray-300))",
          400: "hsl(var(--gray-400))",
          500: "hsl(var(--gray-500))",
          600: "hsl(var(--gray-600))",
          700: "hsl(var(--gray-700))",
          800: "hsl(var(--gray-800))",
          900: "hsl(var(--gray-900))",
          950: "hsl(var(--gray-950))",
        },
      },

      // === 고급 타이포그래피 시스템 ===
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },

      fontSize: {
        // Display 타이포그래피 스케일
        "display-2xl": [
          "4.5rem", // 72px
          {
            lineHeight: "1.1", // 90%
            letterSpacing: "-0.02em",
            fontWeight: "800",
          },
        ],
        "display-xl": [
          "3.75rem", // 60px
          {
            lineHeight: "1.1", // 90%
            letterSpacing: "-0.02em",
            fontWeight: "800",
          },
        ],
        "display-lg": [
          "3rem", // 48px
          {
            lineHeight: "1.15", // 95%
            letterSpacing: "-0.02em",
            fontWeight: "700",
          },
        ],
        "display-md": [
          "2.25rem", // 36px
          {
            lineHeight: "1.2", // 100%
            letterSpacing: "-0.02em",
            fontWeight: "700",
          },
        ],
        "display-sm": [
          "1.875rem", // 30px
          {
            lineHeight: "1.25", // 110%
            letterSpacing: "-0.01em",
            fontWeight: "600",
          },
        ],
        "display-xs": [
          "1.5rem", // 24px
          {
            lineHeight: "1.33", // 110%
            fontWeight: "600",
          },
        ],

        // 본문 텍스트 스케일
        "text-xl": [
          "1.25rem", // 20px
          {
            lineHeight: "1.5", // 150%
            fontWeight: "400",
          },
        ],
        "text-lg": [
          "1.125rem", // 18px
          {
            lineHeight: "1.55", // 150%
            fontWeight: "400",
          },
        ],
        "text-md": [
          "1rem", // 16px
          {
            lineHeight: "1.5", // 150%
            fontWeight: "400",
          },
        ],
        "text-sm": [
          "0.875rem", // 14px
          {
            lineHeight: "1.43", // 140%
            fontWeight: "400",
          },
        ],
        "text-xs": [
          "0.75rem", // 12px
          {
            lineHeight: "1.5", // 140%
            fontWeight: "400",
          },
        ],
        "text-2xs": [
          "0.625rem", // 10px
          {
            lineHeight: "1.6",
            fontWeight: "500",
          },
        ],
      },

      fontWeight: {
        thin: "var(--font-weight-thin)",
        extralight: "var(--font-weight-extralight)",
        light: "var(--font-weight-light)",
        normal: "var(--font-weight-normal)",
        medium: "var(--font-weight-medium)",
        semibold: "var(--font-weight-semibold)",
        bold: "var(--font-weight-bold)",
        extrabold: "var(--font-weight-extrabold)",
        black: "var(--font-weight-black)",
      },

      lineHeight: {
        none: "var(--leading-none)",
        tight: "var(--leading-tight)",
        snug: "var(--leading-snug)",
        normal: "var(--leading-normal)",
        relaxed: "var(--leading-relaxed)",
        loose: "var(--leading-loose)",
      },

      letterSpacing: {
        tighter: "var(--tracking-tighter)",
        tight: "var(--tracking-tight)",
        normal: "var(--tracking-normal)",
        wide: "var(--tracking-wide)",
        wider: "var(--tracking-wider)",
        widest: "var(--tracking-widest)",
      },

      // === 확장된 스페이싱 시스템 (8px 기반) ===
      spacing: {
        px: "var(--space-px)",
        0: "var(--space-0)",
        0.5: "var(--space-0-5)", // 2px
        1: "var(--space-1)", // 4px
        1.5: "var(--space-1-5)", // 6px
        2: "var(--space-2)", // 8px - Base unit
        2.5: "var(--space-2-5)", // 10px
        3: "var(--space-3)", // 12px
        3.5: "var(--space-3-5)", // 14px
        4: "var(--space-4)", // 16px
        5: "var(--space-5)", // 20px
        6: "var(--space-6)", // 24px
        7: "var(--space-7)", // 28px
        8: "var(--space-8)", // 32px
        9: "var(--space-9)", // 36px
        10: "var(--space-10)", // 40px
        11: "var(--space-11)", // 44px
        12: "var(--space-12)", // 48px
        14: "var(--space-14)", // 56px
        16: "var(--space-16)", // 64px
        18: "var(--space-18)", // 72px
        20: "var(--space-20)", // 80px
        22: "var(--space-22)", // 88px
        24: "var(--space-24)", // 96px
        26: "var(--space-26)", // 104px
        28: "var(--space-28)", // 112px
        30: "var(--space-30)", // 120px
        32: "var(--space-32)", // 128px
        36: "var(--space-36)", // 144px
        40: "var(--space-40)", // 160px
        44: "var(--space-44)", // 176px
        48: "var(--space-48)", // 192px
        52: "var(--space-52)", // 208px
        56: "var(--space-56)", // 224px
        60: "var(--space-60)", // 240px
        64: "var(--space-64)", // 256px
        72: "var(--space-72)", // 288px
        80: "var(--space-80)", // 320px
        96: "var(--space-96)", // 384px
      },

      // === 고급 그림자 시스템 ===
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
        "3xl": "var(--shadow-3xl)",
        inner: "var(--shadow-inner)",
        none: "var(--shadow-none)",

        // 컬러 그림자
        figure: "var(--shadow-figure)",
        "figure-lg": "var(--shadow-figure-lg)",
        success: "var(--shadow-success)",
        warning: "var(--shadow-warning)",
        error: "var(--shadow-error)",
      },

      // === 고급 Border Radius 시스템 ===
      borderRadius: {
        none: "var(--radius-none)",
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
        "4xl": "var(--radius-4xl)",
        full: "var(--radius-full)",
      },

      // === 고급 애니메이션 시스템 ===
      transitionDuration: {
        instant: "var(--duration-instant)",
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow: "var(--duration-slow)",
        slower: "var(--duration-slower)",
        slowest: "var(--duration-slowest)",
      },

      transitionTimingFunction: {
        linear: "var(--easing-linear)",
        ease: "var(--easing-ease)",
        "ease-in": "var(--easing-ease-in)",
        "ease-out": "var(--easing-ease-out)",
        "ease-in-out": "var(--easing-ease-in-out)",
        bounce: "var(--easing-bounce)",
        spring: "var(--easing-spring)",
        smooth: "var(--easing-smooth)",
      },

      // === Z-Index 스케일 ===
      zIndex: {
        auto: "var(--z-auto)",
        0: "var(--z-0)",
        10: "var(--z-10)",
        20: "var(--z-20)",
        30: "var(--z-30)",
        40: "var(--z-40)",
        50: "var(--z-50)",
        dropdown: "var(--z-dropdown)",
        sticky: "var(--z-sticky)",
        fixed: "var(--z-fixed)",
        "modal-backdrop": "var(--z-modal-backdrop)",
        modal: "var(--z-modal)",
        popover: "var(--z-popover)",
        tooltip: "var(--z-tooltip)",
        toast: "var(--z-toast)",
      },

      // === 고급 키프레임 & 애니메이션 ===
      keyframes: {
        // 기존 shadcn/ui 애니메이션 유지
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },

        // 고급 슬라이드 애니메이션
        "slide-in-from-top": {
          "0%": { 
            transform: "translateY(-12px)", 
            opacity: "0" 
          },
          "100%": { 
            transform: "translateY(0)", 
            opacity: "1" 
          },
        },
        "slide-in-from-bottom": {
          "0%": { 
            transform: "translateY(12px)", 
            opacity: "0" 
          },
          "100%": { 
            transform: "translateY(0)", 
            opacity: "1" 
          },
        },
        "slide-in-from-left": {
          "0%": { 
            transform: "translateX(-12px)", 
            opacity: "0" 
          },
          "100%": { 
            transform: "translateX(0)", 
            opacity: "1" 
          },
        },
        "slide-in-from-right": {
          "0%": { 
            transform: "translateX(12px)", 
            opacity: "0" 
          },
          "100%": { 
            transform: "translateX(0)", 
            opacity: "1" 
          },
        },

        // 페이드 애니메이션
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },

        // 스케일 애니메이션
        "scale-in": {
          "0%": { 
            transform: "scale(0.95)", 
            opacity: "0" 
          },
          "100%": { 
            transform: "scale(1)", 
            opacity: "1" 
          },
        },
        "scale-out": {
          "0%": { 
            transform: "scale(1)", 
            opacity: "1" 
          },
          "100%": { 
            transform: "scale(0.95)", 
            opacity: "0" 
          },
        },

        // 바운스 애니메이션
        "bounce-in": {
          "0%": { 
            transform: "scale(0.8)", 
            opacity: "0" 
          },
          "50%": { 
            transform: "scale(1.05)", 
            opacity: "1" 
          },
          "100%": { 
            transform: "scale(1)", 
            opacity: "1" 
          },
        },

        // 로딩 애니메이션
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },

        // 흔들림 애니메이션
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-2px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(2px)" },
        },

        // 플로팅 애니메이션
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },

        // 회전 애니메이션
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },

        // 글로우 효과
        "glow": {
          "0%, 100%": { 
            boxShadow: "0 0 5px hsl(var(--figure-500) / 0.5)" 
          },
          "50%": { 
            boxShadow: "0 0 20px hsl(var(--figure-500) / 0.8)" 
          },
        },

        // 타이핑 효과
        "typing": {
          "0%": { width: "0" },
          "100%": { width: "100%" },
        },

        // 그라디언트 이동
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },

      animation: {
        // 기존 애니메이션 유지
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",

        // 고급 애니메이션
        "slide-in-from-top": "slide-in-from-top 0.3s var(--easing-ease-out)",
        "slide-in-from-bottom": "slide-in-from-bottom 0.3s var(--easing-ease-out)",
        "slide-in-from-left": "slide-in-from-left 0.3s var(--easing-ease-out)",
        "slide-in-from-right": "slide-in-from-right 0.3s var(--easing-ease-out)",

        "fade-in": "fade-in 0.2s var(--easing-ease-out)",
        "fade-out": "fade-out 0.2s var(--easing-ease-in)",

        "scale-in": "scale-in 0.2s var(--easing-bounce)",
        "scale-out": "scale-out 0.2s var(--easing-ease-in)",

        "bounce-in": "bounce-in 0.5s var(--easing-bounce)",

        "pulse-slow": "pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",

        "shake": "shake 0.5s ease-in-out",
        "float": "float 3s ease-in-out infinite",
        "spin-slow": "spin-slow 3s linear infinite",

        "glow": "glow 2s ease-in-out infinite alternate",
        "typing": "typing 2s steps(20, end)",
        "gradient-shift": "gradient-shift 3s ease infinite",

        // 조합 애니메이션
        "fade-in-up": "slide-in-from-bottom 0.4s var(--easing-ease-out)",
        "fade-in-down": "slide-in-from-top 0.4s var(--easing-ease-out)",
        "zoom-in": "scale-in 0.3s var(--easing-spring)",
      },

      // === 반응형 브레이크포인트 확장 ===
      screens: {
        xs: "475px", // Extra small devices
        sm: "640px", // Small devices
        md: "768px", // Medium devices
        lg: "1024px", // Large devices
        xl: "1280px", // Extra large devices
        "2xl": "1536px", // 2X large devices
        "3xl": "1600px", // 3X large devices
        "4xl": "1920px", // 4X large devices

        // 고도 특정 브레이크포인트
        "tall": { raw: "(min-height: 800px)" },
        "short": { raw: "(max-height: 600px)" },

        // 접근성 브레이크포인트
        "motion-safe": { raw: "(prefers-reduced-motion: no-preference)" },
        "motion-reduce": { raw: "(prefers-reduced-motion: reduce)" },
        "high-contrast": { raw: "(prefers-contrast: high)" },
        "dark": { raw: "(prefers-color-scheme: dark)" },
      },

      // === 고급 백드롭 필터 ===
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
        "3xl": "40px",
      },

      // === 고급 그라디언트 스탑 ===
      gradientColorStops: {
        inherit: "inherit",
        current: "currentColor",
        transparent: "transparent",
      },

      // === 컨테이너 쿼리 지원 ===
      containers: {
        xs: "20rem",
        sm: "24rem",
        md: "28rem",
        lg: "32rem",
        xl: "36rem",
        "2xl": "42rem",
        "3xl": "48rem",
        "4xl": "56rem",
        "5xl": "64rem",
        "6xl": "72rem",
        "7xl": "80rem",
      },

      // === 아스펙트 비율 ===
      aspectRatio: {
        auto: "auto",
        square: "1 / 1",
        video: "16 / 9",
        "4/3": "4 / 3",
        "3/2": "3 / 2",
        "2/3": "2 / 3",
        "9/16": "9 / 16",
        "1/2": "1 / 2",
        "2/1": "2 / 1",
      },

      // === 고급 텍스트 언더라인 ===
      textDecorationThickness: {
        auto: "auto",
        "from-font": "from-font",
        0: "0px",
        1: "1px",
        2: "2px",
        4: "4px",
        8: "8px",
      },

      textUnderlineOffset: {
        auto: "auto",
        0: "0px",
        1: "1px",
        2: "2px",
        4: "4px",
        8: "8px",
      },

      // === 고급 보더 시스템 ===
      borderWidth: {
        0: "0px",
        1: "1px",
        2: "2px",
        3: "3px",
        4: "4px",
        6: "6px",
        8: "8px",
      },

      // === 고급 아웃라인 시스템 ===
      outlineWidth: {
        0: "0px",
        1: "1px",
        2: "2px",
        4: "4px",
        8: "8px",
      },

      outlineOffset: {
        0: "0px",
        1: "1px",
        2: "2px",
        4: "4px",
        8: "8px",
      },

      // === 고급 링 시스템 ===
      ringWidth: {
        0: "0px",
        1: "1px",
        2: "2px",
        3: "3px",
        4: "4px",
        8: "8px",
      },

      ringOffsetWidth: {
        0: "0px",
        1: "1px",
        2: "2px",
        4: "4px",
        8: "8px",
      },
    },
  },
  plugins: [
    // Tailwind CSS 공식 플러그인들
    require("@tailwindcss/typography"),
    require("@tailwindcss/forms"),
    require("@tailwindcss/aspect-ratio"),
    require("@tailwindcss/container-queries"),

    // 커스텀 플러그인
    function ({ addUtilities, addComponents, theme }) {
      // 고급 유틸리티 클래스
      addUtilities({
        // 텍스트 렌더링 최적화
        ".text-render-optimize": {
          "-webkit-font-smoothing": "antialiased",
          "-moz-osx-font-smoothing": "grayscale",
          "text-rendering": "optimizeLegibility",
        },

        // GPU 가속 유틸리티
        ".gpu-acceleration": {
          transform: "translate3d(0, 0, 0)",
          backfaceVisibility: "hidden",
          perspective: "1000px",
        },

        // 안전 영역 패딩
        ".safe-area-inset": {
          paddingTop: "env(safe-area-inset-top)",
          paddingRight: "env(safe-area-inset-right)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
        },

        // 터치 최적화
        ".touch-manipulation": {
          touchAction: "manipulation",
        },

        // 웹킷 스크롤바 숨김
        ".webkit-scrollbar-hide": {
          "&::-webkit-scrollbar": {
            display: "none",
          },
        },
      });

      // 고급 컴포넌트 클래스
      addComponents({
        // 커스텀 컨테이너
        ".container-fluid": {
          width: "100%",
          maxWidth: "none",
          marginLeft: "auto",
          marginRight: "auto",
          paddingLeft: theme("spacing.4"),
          paddingRight: theme("spacing.4"),
        },

        // 플렉스 센터링
        ".flex-center": {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },

        // 절대 센터링
        ".absolute-center": {
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        },

        // 고급 그리드 레이아웃
        ".grid-auto-fit": {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: theme("spacing.6"),
        },

        ".grid-auto-fill": {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: theme("spacing.4"),
        },
      });
    },
  ],
};
