# Stream-Based CSV Import Architecture

## 🏗️ Mimari Genel Bakış

Bu modül, büyük CSV dosyalarını verimli bir şekilde import etmek için **Node.js Stream API** kullanır. Tüm dosyayı RAM'e yüklemeden, parça parça (chunk) işleyerek milyonlarca satırlık dosyaları bile işleyebilir.

## 📁 Modüler Yapı

### 1. **Data Transformers** (`utils/data-transformers.ts`)
- **Sorumluluk**: CSV verilerini database formatına dönüştürme
- **Fonksiyonlar**:
  - `transformValue()` - Tek bir değeri dönüştürür
  - `transformRecord()` - Tüm kaydı dönüştürür
  - JSONB, UUID, Boolean, Numeric dönüşümleri

### 2. **Validators** (`utils/validators.ts`)
- **Sorumluluk**: Veri validasyonu ve duplicate kontrolü
- **Fonksiyonlar**:
  - `removeDuplicateIds()` - ID bazlı duplicate kontrolü
  - `removeDuplicateEmails()` - Email bazlı duplicate kontrolü
  - `filterValidForeignKeys()` - Foreign key validasyonu
  - `validateBatch()` - Batch seviyesinde validasyon

### 3. **Database Helpers** (`utils/database-helpers.ts`)
- **Sorumluluk**: Database işlemleri ve schema sorguları
- **Fonksiyonlar**:
  - `getTableColumns()` - Tablo kolonlarını sorgular
  - `getValidCustomerUserIds()` - Geçerli user ID'lerini getirir
  - `executeBatchInsert()` - Batch insert işlemi
  - `truncateTable()` - Tabloyu temizler

### 4. **CSV Stream Processor** (`import-csv.ts`)
- **Sorumluluk**: Stream processing ve batch yönetimi
- **Özellikler**:
  - Stream-based file reading
  - Batch processing (1000 kayıt/batch)
  - Progress tracking
  - Error handling

## 🔄 İşlem Akışı

```
CSV File
    ↓
[File Stream] → [CSV Parser] → [Record Processor] → [Batch Accumulator]
                                                          ↓
                                                    [Batch Size = 1000]
                                                          ↓
                                                    [Validate & Transform]
                                                          ↓
                                                    [Database Insert]
```

## 💡 Temel Prensipler

### 1. **Single Responsibility Principle**
Her modül tek bir sorumluluğa sahip:
- Transformers → Sadece veri dönüşümü
- Validators → Sadece validasyon
- Helpers → Sadece database işlemleri

### 2. **Separation of Concerns**
- İş mantığı (business logic) ayrı
- Veri erişimi (data access) ayrı
- Stream processing ayrı

### 3. **Memory Efficiency**
- Tüm dosya RAM'e yüklenmez
- Chunk'lar halinde işlenir
- Batch'ler halinde database'e yazılır

## 🚀 Kullanım

```typescript
// Otomatik import (tüm dosyalar)
npm run import-csv

// Programatik kullanım
import { importCSVFile } from './import-csv';

await importCSVFile(
  '/path/to/file.csv',
  'table_name',
  ['skip_column1', 'skip_column2']
);
```

## 📊 Performans

### Önceki Yöntem (readFileSync)
- ❌ Tüm dosya RAM'e yüklenir
- ❌ 500MB+ dosyalar için "Out of Memory" hatası
- ❌ Büyük dosyalar işlenemez

### Yeni Yöntem (Stream)
- ✅ Dosya parça parça okunur
- ✅ 10GB+ dosyalar işlenebilir
- ✅ Düşük RAM kullanımı
- ✅ Batch processing ile verimli insert

## 🔧 Konfigürasyon

```typescript
const BATCH_SIZE = 1000; // Her batch'te 1000 kayıt
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB limit
```

## 📝 Notlar

- Stream processing sırasında her kayıt tek tek işlenir
- Batch'ler 1000 kayıt dolduğunda otomatik olarak database'e yazılır
- Duplicate kontrolü her kayıt için yapılır (Set kullanarak)
- Foreign key validasyonu sadece gerekli tablolar için yapılır

## 🎯 Avantajlar

1. **Ölçeklenebilirlik**: Milyonlarca satır işlenebilir
2. **Bellek Verimliliği**: Düşük RAM kullanımı
3. **Hata Toleransı**: Bir kayıt hata verse bile devam eder
4. **Modülerlik**: Kolay test edilebilir ve bakım yapılabilir
5. **Temiz Kod**: Her modül tek sorumluluğa sahip

