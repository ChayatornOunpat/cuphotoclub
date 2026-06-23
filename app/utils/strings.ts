// Centralized Thai copy. Single source of truth so English can be layered on
// later via @nuxtjs/i18n without hunting through templates (the "i18n seam").
export const strings = {
  brand: 'CU Photo Club',
  footerTagline: 'ชมรมถ่ายภาพแห่งจุฬาลงกรณ์มหาวิทยาลัย',

  nav: {
    home: 'หน้าแรก',
    galleries: 'แกลเลอรี',
    blog: 'บทความ',
    activities: 'กิจกรรม',
    about: 'เกี่ยวกับเรา',
    contact: 'ติดต่อเรา'
  },

  home: {
    eyebrow: 'CU Photo Club',
    heroTitle: 'บันทึกทุกช่วงเวลาผ่านเลนส์',
    heroSubtitle: 'ภาพถ่ายกิจกรรม บทความ และผลงานจากชมรมถ่ายภาพ',
    viewGalleries: 'ดูแกลเลอรีทั้งหมด'
  }
} as const

export const navLinks = [
  { to: '/', label: strings.nav.home },
  { to: '/galleries', label: strings.nav.galleries },
  { to: '/blog', label: strings.nav.blog },
  { to: '/activities', label: strings.nav.activities },
  { to: '/about', label: strings.nav.about },
  { to: '/contact', label: strings.nav.contact }
] as const
