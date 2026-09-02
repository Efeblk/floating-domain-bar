# Değişiklik Günlüğü

Bu projedeki önemli değişiklikler bu dosyada belgelenir.

## [0.20.0] - 2026-09-02

### Eklendi

- Domain kapsülünün alt kenarında Safari benzeri, açık/koyu tona uyumlu ince
  mavi yükleme çizgisi; tek sekme ve Split View için aynı görünüm
- Her tarayıcı panelinin bağımsız yükleme durumu, başarılı bitiş animasyonu
  ve iptal/hata durumunda tamamlanmadan sönme
- Sekme değiştirme, hızlı yeniden yükleme, kapanan sekmeler ve mod temizliği
  için yükleme durumu/zamanlayıcı yönetimi; azaltılmış hareket desteği
- Yükleme takibi ve tek/split bar olay bağlantıları için bağımlılıksız 15
  otomatik regresyon testi

## [0.19.8] - 2026-09-02

### Düzeltildi

- Zen'in web alanına eklenen XUL katmanlarını Windows başlık bölgesi olarak
  kaydetmemesi nedeniyle çalışmayan CSS tabanlı pencere sürükleme
- Boş üst satır artık eşik kontrollü pointer takibiyle ayrıcalıklı Zen
  penceresini taşır; büyütülmüş pencere sürüklenince önce normal boyuta döner
- Boş üst satıra çift tıklayınca pencerenin büyütülmesi veya geri yüklenmesi

## [0.19.7] - 2026-09-01

### Eklendi

- Üst satırın boş bölgelerinde Zen penceresini Windows'un yerel başlık çubuğu
  davranışıyla sağa sola sürükleme desteği

### Düzeltildi

- Sürükleme bölgesinin domain alanı, geri/ileri/yenile, Zen menüsü ve Windows
  pencere düğmelerinin tıklama alanlarını yutması engellendi

## [0.19.6] - 2026-08-31

### Düzeltildi

- Domain alanına tıklayınca açılan Zen floating URL editörünün görünmesine
  rağmen klavye odağını almaması
- Sidebar'dan yeni sekme açıldığında adres alanına yazabilmek için ikinci kez
  tıklama gerekmesi; input artık açılış karesinde odaklanıp adresi seçiyor

## [0.19.5] - 2026-08-30

### Düzeltildi

- Zen'in üst/sol split panel için tam pencere boyutunda raporladığı iç browser
  kutusu artık doğrudan panel yüksekliği/genişliği kabul edilmiyor
- Komşu split panelin başlangıç çizgisi gerçek alt/sağ sınır olarak kullanılıyor;
  native floating editör üst-alt, yan-yana ve grid düzenlerinde kendi hücresinin
  merkezinde kalıyor

## [0.19.4] - 2026-08-30

### Düzeltildi

- Domain kapsülünün gecikmeli komut çağrısının bazı tıklamalarda Zen floating
  editörünü açmaması; çağrı artık doğrudan `Ctrl+L` komutuyla aynı akışta
- Tek sekmedeki native floating editör de Split View ile aynı görünür panel
  geometrisini kullanıyor
- Zen'in başlangıçta kendiliğinden açtığı floating editörün konumu mod
  yüklendiğinde hemen eşitleniyor

## [0.19.3] - 2026-08-30

### Düzeltildi

- Zen'in gerçek `urlbar-container` öğesi artık özel üst satıra taşınmıyor;
  kendi toolbar DOM'unda kaldığı için yerleşik floating URL görünümü yeniden
  çalışıyor
- Üstteki kalıcı domain kapsülü yalnızca görünüm ve tetikleyici olarak ayrıldı;
  tıklama Zen'in yerel `Browser:OpenLocation` komutunu açıyor

## [0.19.2] - 2026-08-30

### Değiştirildi

- Domain alanına tıklamak artık özel bir metin kutusunu taşımak yerine Zen'in
  yerleşik bağımsız floating URL editörünü açıyor
- Split View'daki her domain alanı önce kendi sekmesini etkinleştiriyor, ardından
  aynı yerel editörü kendi görünür panel sınırlarında responsive olarak açıyor
- `Ctrl+L` tekrar Zen'in kendi URL bar komutuna bırakıldı; geçmiş, öneriler,
  arama modları ve klavye davranışları korunuyor

## [0.19.1] - 2026-08-30

### Düzeltildi

- Taşınmış yerel URL çubuğunda Zen'in floating durumunun tetiklenmemesi
- Üst/alt Split View'da tam yüksekliğe sahip iç tarayıcı kutusunun görünür
  panel yerine kullanılması nedeniyle odaklanan alanın split çizgisine inmesi
- Split panelin kırpan üst elemanları ve değişen split oranları artık görünür
  merkez hesabına dahil ediliyor

## [0.19.0] - 2026-08-30

### Eklendi

- Tek sekmede Zen'in yerleşik merkezde açılan adres editörü yeniden etkin
- Split View'da odaklanan adres alanının yalnızca kendi görünür panelinin
  merkezine taşındığı responsive düzenleme görünümü
- Yatay ve dikey split oranları ile pencere boyutu değişikliklerinde canlı
  merkezleme

## [0.18.4] - 2026-08-30

### Düzeltildi

- X/Twitter'ın kaydırma sırasında kullandığı yarı şeffaf sticky header renginin
  Zen tema rengiyle karışıp üst şeridi morlaştırması
- Sanallaştırılmış akışa yeni içerik eklenmesinin gereksiz renk örneklemesi
  başlatması

## [0.18.3] - 2026-08-30

### Düzeltildi

- X/Twitter gibi sanallaştırılmış akışlarda scroll sırasında oluşan geçici boş
  renk örneğinin son geçerli sayfa rengini silmesi

### Değiştirildi

- Scroll sırasında gereksiz zemin rengi örneklemesi kaldırıldı; renk sayfa
  yüklenirken, görünüm değişirken ve navigasyonda güncellenmeye devam ediyor

## [0.18.2] - 2026-08-30

### Değiştirildi

- Dış kontrol ikonları örneklenen açık/koyu sayfa tonuna dinamik bağlandı
- Sayfa tonu henüz bilinmiyorken kontursuz nötr gri yedek renk kullanılıyor

## [0.18.1] - 2026-08-30

### Değiştirildi

- Kapsül dışındaki kontrol ikonları, beyaz ve siyah zeminlerde örnekleme
  sonucundan bağımsız görünen kontursuz nötr tona geçirildi

## [0.18.0] - 2026-08-30

### Değiştirildi

- Dinamik ve SPA tabanlı sitelerde sayfa rengi, ilk yüklemeden sonra birkaç
  aşamada tekrar örnekleniyor
- Aynı sekme içindeki adres geçişleri ve yeniden seçilen sekmeler renk
  örneklemesini yeniden tetikliyor
- Dış kontrol ikonları beyaz kontur yerine örneklenen zemine göre doğrudan
  açık veya koyu renk kullanıyor

## [0.17.3] - 2026-08-30

### Düzeltildi

- Beyaz veya örneklenemeyen sayfa zeminlerinde gezinme, menü ve pencere
  kontrol ikonlarının görünmez olması

## [0.17.2] - 2026-08-30

### Düzeltildi

- `Ctrl+L` ile odaklanan boş adres alanında placeholder ve `Yeni Sekme`
  etiketinin aynı anda görünmesi

## [0.17.1] - 2026-08-30

### Eklendi

- Görünür sayfa zemini için çok noktalı renk örnekleme
- Açık ve koyu sayfalara göre otomatik kontrol ve materyal kontrastı
- Zen'in Only Sidebar, Sidebar and Top Toolbar ve Collapsed Sidebar
  yerleşimleri için uyumluluk

### Düzeltildi

- Windows küçültme, büyütme ve kapatma düğmelerinin ilk tıklamadaki hatalı
  tıklama alanı
- Dar pencerelerde Zen menüsü ile Windows pencere düğmelerinin çakışması
- Split View'da bağımsız adres alanlarının konumu ve responsive davranışı
- Compact Mode geçişinde adres çubuğunun merkezden kayması
- Bazı sayfalarda zemin ve kontrol renklerinin okunamaması

[0.17.1]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.17.1
[0.17.2]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.17.2
[0.17.3]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.17.3
[0.18.0]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.18.0
[0.18.1]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.18.1
[0.18.2]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.18.2
[0.18.3]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.18.3
[0.18.4]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.18.4
[0.19.0]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.19.0
[0.19.1]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.19.1
[0.19.2]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.19.2
[0.19.3]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.19.3
[0.19.4]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.19.4
[0.19.5]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.19.5
[0.19.6]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.19.6
[0.19.7]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.19.7
[0.19.8]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.19.8
[0.20.0]: https://github.com/Efeblk/floating-domain-bar/releases/tag/v0.20.0
