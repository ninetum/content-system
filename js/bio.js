/* หน้ารวมลิงก์สาธารณะ (link-in-bio)
 * อ่านข้อมูลด้วย anon key ผ่าน policy ที่เปิดไว้เฉพาะสินค้าที่ติ๊ก in_bio และลิงก์ที่ public_bio
 * ไม่มีข้อมูลภายในรั่วออกหน้านี้ — ตารางอื่นยังถูก RLS กันไว้ตามเดิม
 */
function bioPage() {
  const CFG = window.CMS_CONFIG;

  return {
    cfg: CFG.bio,
    loading: true,
    error: '',
    items: [],

    async init() {
      if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) {
        this.error = 'ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล';
        this.loading = false;
        return;
      }

      try {
        const client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);

        const [products, links] = await Promise.all([
          client.from('products')
            .select('id,name,price,image_url,merchant,product_type,sort_order')
            .order('sort_order', { ascending: true }),
          client.from('tracked_links').select('id,code,product_id'),
        ]);

        if (products.error) throw new Error(products.error.message);
        if (links.error) throw new Error(links.error.message);

        const linkOf = {};
        for (const l of links.data || []) if (l.product_id) linkOf[l.product_id] = l.code;

        const base = CFG.supabaseUrl.replace(/\/$/, '');

        this.items = (products.data || [])
          .filter((p) => linkOf[p.id])                    // มีลิงก์ติดตามผลแล้วเท่านั้น
          .map((p) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price) || 0,
            priceText: (Number(p.price) || 0).toLocaleString('th-TH') + ' ฿',
            image_url: p.image_url || '',
            // ของเราเองต้องบอกให้ชัดว่าจองตรง ไม่ใช่ลิงก์ไปร้านคนอื่น
            icon: p.product_type === 'own'
              ? '🎫'
              : ((CFG.merchants.find((m) => m.id === p.merchant) || {}).icon || '🔗'),
            merchantName: p.product_type === 'own'
              ? 'จองกับเราโดยตรง'
              : ((CFG.merchants.find((m) => m.id === p.merchant) || {}).name || 'ร้านค้า'),
            href: `${base}/functions/v1/r/${linkOf[p.id]}`,
          }));
      } catch (e) {
        this.error = 'โหลดรายการไม่สำเร็จ ลองรีเฟรชอีกครั้งนะครับ';
        console.error(e);
      } finally {
        this.loading = false;
      }
    },
  };
}
