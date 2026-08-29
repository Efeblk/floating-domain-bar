> bu proje tamamen ai ile yazılmamıştır, bununla ilgili bir sorununuz varsa umurumda değil

# Floating Domain Bar

Zen Browser için minimal, responsive bir adres çubuğu modu. Tarayıcının üstünde
gerçek bir alan ayırır; boşta tam URL yerine yalnızca sitenin ana alan adını
gösterir.

```text
https://www.youtube.com/watch?v=abc  ->  youtube.com
https://mail.google.com/...          ->  google.com
```

Adres alanına tıklandığında veya `Ctrl+L` kullanıldığında gerçek URL normal
şekilde görünür ve düzenlenebilir. Mod, adresin gerçek değerini değiştirmez.

## Özellikler

- Adres çubuğunu web alanının merkezinde tutar.
- Site boşta görüntülenirken yalnızca ana domaini gösterir.
- Web sayfasına dokunmadan üstte 52 piksellik gerçek tarayıcı alanı ayırır.
- Sayfanın üst kenarındaki görünür zemin rengini örnekleyerek boş alanları
  sayfayla uyumlu hale getirir.
- Açık ve koyu sayfalarda yazı, ikon, kenarlık ve cam yüzey kontrastını otomatik
  ayarlar.
- Geri, ileri, yenile ve Zen menü düğmelerini adres alanının yanında tutar.
- Windows küçültme, büyütme ve kapatma düğmelerinin tıklama alanını sabitler.
- Zen Split View'da her görünür panel için bağımsız ve responsive bir
  adres/arama alanı oluşturur.
- `Ctrl+S` Compact Mode ve Zen'in üç tarayıcı yerleşimini destekler.

## Desteklenen Zen yerleşimleri

- **Only Sidebar**
- **Sidebar and Top Toolbar**
- **Collapsed Sidebar**

Sidebar ve pencere genişliği canlı ölçülür. Adres alanı dar pencerelerde Windows
düğmeleriyle veya Zen menüsüyle üst üste binmeden küçülür.

## Gereksinimler

- [Zen Browser](https://zen-browser.app/)
- [Sine](https://github.com/CosmoCreeper/Sine)
- Sine ayarlarında mağaza dışındaki JavaScript modlarına izin verilmesi

## Sine ile kurulum

1. Zen'de `Ayarlar > Sine Mods` bölümünü açın.
2. Mağaza dışındaki JavaScript modlarına izin verin.
3. Depo/URL ile kurulum alanına aşağıdaki bağlantıyı yapıştırın:

   ```text
   https://github.com/Efeblk/floating-domain-bar
   ```

4. Modu kurun ve Zen'i yeniden başlatın.

Bir güncellemeden sonra görünüm değişmezse modu Sine üzerinden yeniden yükleyip
Zen'i tamamen kapatarak tekrar açın.

## Nasıl çalışır?

Mod yalnızca Zen'in tarayıcı arayüzünü değiştirir. Web sayfasının DOM'u,
`body` konumu, padding'i, transform'u veya CSS'i değiştirilmez. Sayfa zemini
salt okunur olarak örneklenir ve yalnızca ayrılan tarayıcı satırında kullanılır.

Split View açıldığında her panel kendi sitesinin zemin rengini ve adresini ayrı
izler. Bir panelin adres alanına tıklamak o paneli etkinleştirir; yazılan adres
veya arama yalnızca o panelde açılır.

## Dosyalar

- `userChrome.css` — üst satırın, adres alanının ve kontrollerin görünümü
- `floating-domain-bar.uc.js` — domain etiketi, renk örnekleme ve Split View
  davranışı
- `theme.json` — Sine paket tanımı ve sürüm bilgisi

## Uyumluluk

Windows üzerinde Zen `1.21.16b` / Gecko `154.0.1` ile test edilmiştir. Zen'in
dahili arayüz kimlikleri sürümler arasında değişebildiği için gelecekteki büyük
Zen güncellemeleri küçük uyumluluk düzeltmeleri gerektirebilir.

Linux ve macOS henüz test edilmemiştir.

## Gizlilik

Mod ağ isteği göndermez, geçmiş veya adres verisi kaydetmez ve harici bir
sunucuya bağlanmaz. Tüm davranış tarayıcı içinde yerel olarak çalışır.

## Sürüm notları

Değişiklik geçmişi için [CHANGELOG.md](CHANGELOG.md) dosyasına bakın.

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile sunulur.
