/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // === 기존 색상 시스템 (shadcn/ui 호환) ===
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

        // === 확장 Design Token 색상 시스템 ===
        // Figure 브랜드 색상
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

        // 상태 색상 확장
        success: {
          50: "hsl(var(--success-50))",
          500: "hsl(var(--success-500))",
          600: "hsl(var(--success-600))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          50: "hsl(var(--warning-50))",
          500: "hsl(var(--warning-500))",
          600: "hsl(var(--warning-600))",
          foreground: "hsl(var(--warning-foreground))",
        },
        error: {
          50: "hsl(var(--error-50))",
          500: "hsl(var(--error-500))",
          600: "hsl(var(--error-600))",
          foreground: "hsl(var(--error-foreground))",
        },
        info: {
          50: "hsl(var(--info-50))",
          500: "hsl(var(--info-500))",
          600: "hsl(var(--info-600))",
          foreground: "hsl(var(--info-foreground))",
        },

        // 확장 그레이 스케일
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

      // === 타이포그래피 시스템 ===
      fontSize: {
        "display-2xl": [
          "4.5rem",
          { lineHeight: "90%", letterSpacing: "-0.02em" },
        ],
        "display-xl": [
          "3.75rem",
          { lineHeight: "90%", letterSpacing: "-0.02em" },
        ],
        "display-lg": ["3rem", { lineHeight: "95%", letterSpacing: "-0.02em" }],
        "display-md": [
          "2.25rem",
          { lineHeight: "100%", letterSpacing: "-0.02em" },
        ],
        "display-sm": [
          "1.875rem",
          { lineHeight: "110%", letterSpacing: "-0.01em" },
        ],
        "display-xs": ["1.5rem", { lineHeight: "110%" }],

        "text-xl": ["1.25rem", { lineHeight: "150%" }],
        "text-lg": ["1.125rem", { lineHeight: "150%" }],
        "text-md": ["1rem", { lineHeight: "150%" }],
        "text-sm": ["0.875rem", { lineHeight: "140%" }],
        "text-xs": ["0.75rem", { lineHeight: "140%" }],
      },

      // === 확장 스페이싱 시스템 ===
      spacing: {
        0.5: "0.125rem", // 2px
        1.5: "0.375rem", // 6px
        2.5: "0.625rem", // 10px
        3.5: "0.875rem", // 14px
        4.5: "1.125rem", // 18px
        5.5: "1.375rem", // 22px
        6.5: "1.625rem", // 26px
        7.5: "1.875rem", // 30px
        8.5: "2.125rem", // 34px
        9.5: "2.375rem", // 38px
        18: "4.5rem", // 72px
        22: "5.5rem", // 88px
        26: "6.5rem", // 104px
        30: "7.5rem", // 120px
      },

      // === 그림자 시스템 ===
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
        "3xl": "var(--shadow-3xl)",
      },

      // === 확장 Border Radius ===
      borderRadius: {
        none: "0px",
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
        full: "9999px",
      },

      // === 애니메이션 시스템 ===
      transitionDuration: {
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow: "var(--duration-slow)",
      },

      transitionTimingFunction: {
        "ease-in-out-back": "var(--easing-ease-in-out-back)",
        "ease-spring": "var(--easing-ease-spring)",
      },

      // === 기존 애니메이션 유지 ===
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-in-from-top": {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-from-right": {
          "0%": { transform: "translateX(10px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },

      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in-from-top": "slide-in-from-top 0.3s ease-out",
        "slide-in-from-right": "slide-in-from-right 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
      },

      // === 반응형 브레이크포인트 확장 ===
      screens: {
        xs: "475px",
        "3xl": "1600px",
      },
    },
  },
  plugins: [],
};
