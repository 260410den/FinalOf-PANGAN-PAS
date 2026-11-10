<?php
declare(strict_types=1);
require __DIR__ . '/../account_lib.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
account_boot($method === 'POST');

const CHECK_HOURS = 12;

function rule_out(array $r): array {
    return [
        'id' => (int)$r['id'], 'komoditas' => $r['komoditas'], 'wilayah' => $r['wilayah'], 'jenisPasar' => $r['jenis_pasar'],
        'arah' => $r['arah'], 'tipeBatas' => $r['tipe_batas'], 'nilaiBatas' => (float)$r['nilai_batas'], 'periode' => $r['periode'],
        'aktif' => (bool)$r['aktif'], 'terakhirDicek' => iso($r['terakhir_dicek']), 'terakhirDikirim' => iso($r['terakhir_dikirim']),
        'perluDicek' => (bool)$r['aktif'] && ($r['terakhir_dicek'] === null || strtotime($r['terakhir_dicek']) < time() - CHECK_HOURS * 3600),
    ];
}
function notif_out(array $n): array {
    return [
        'id' => (int)$n['id'], 'pantauanId' => $n['pantauan_id'] === null ? null : (int)$n['pantauan_id'],
        'komoditas' => $n['komoditas'], 'wilayah' => $n['wilayah'], 'jenisPasar' => $n['jenis_pasar'],
        'hargaAwal' => (int)$n['harga_awal'], 'hargaAkhir' => (int)$n['harga_akhir'], 'persen' => (float)$n['persen'],
        'periode' => $n['periode'], 'tanggalAwal' => $n['tanggal_awal'], 'tanggalAkhir' => $n['tanggal_akhir'],
        'sumber' => $n['sumber'], 'dibaca' => (bool)$n['dibaca'], 'dibuat' => iso($n['dibuat']),
    ];
}
function load_rule(int $id, int $uid): array {
    $st = db()->prepare('SELECT * FROM pantauan_harga WHERE id = ? AND pengguna_id = ?');
    $st->execute([$id, $uid]);
    $r = $st->fetch();
    if (!$r) json_out(['ok' => false, 'error' => 'Pantauan tidak ditemukan.'], 404);
    return $r;
}
function valid_date($v): string {
    $v = (string)$v;
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) || !strtotime($v)) json_out(['ok' => false, 'error' => 'Tanggal tidak valid.'], 422);
    return $v;
}

try {
    $u = require_user();
    $uid = (int)$u['id'];
    $pdo = db();

    if ($method === 'GET') {
        $st = $pdo->prepare('SELECT * FROM pantauan_harga WHERE pengguna_id = ? ORDER BY dibuat DESC, id DESC');
        $st->execute([$uid]);
        $rules = array_map('rule_out', $st->fetchAll());
        $st = $pdo->prepare('SELECT * FROM notifikasi_harga WHERE pengguna_id = ? ORDER BY dibuat DESC, id DESC LIMIT 30');
        $st->execute([$uid]);
        $notifs = array_map('notif_out', $st->fetchAll());
        $unread = count(array_filter($notifs, fn($n) => !$n['dibaca']));
        json_out(['ok' => true, 'pantauan' => $rules, 'notifikasi' => $notifs, 'belumDibaca' => $unread]);
    }
    if ($method !== 'POST') json_out(['ok' => false, 'error' => 'Metode tidak didukung.'], 405);
    $action = (string)($_GET['action'] ?? '');
    $in = read_json();

    if ($action === 'buat') {
        $st = $pdo->prepare('SELECT COUNT(*) FROM pantauan_harga WHERE pengguna_id = ?');
        $st->execute([$uid]);
        if ((int)$st->fetchColumn() >= 20) json_out(['ok' => false, 'error' => 'Maksimal 20 pantauan per akun.'], 422);
        $kom = (string)($in['komoditas'] ?? '');
        $wil = (string)($in['wilayah'] ?? '');
        $jenis = (string)($in['jenisPasar'] ?? 'tradisional');
        $arah = (string)($in['arah'] ?? 'keduanya');
        $tipe = (string)($in['tipeBatas'] ?? 'persen');
        $nilai = (float)($in['nilaiBatas'] ?? 0);
        $periode = (string)($in['periode'] ?? '7 hari');
        if (!in_array($kom, COMMODITIES, true)) json_out(['ok' => false, 'error' => 'Komoditas tidak dikenal.'], 422);
        if ($wil !== 'Indonesia' && !in_array($wil, PROVINCES, true)) json_out(['ok' => false, 'error' => 'Wilayah tidak dikenal.'], 422);
        if (!in_array($jenis, ['tradisional', 'modern'], true)) json_out(['ok' => false, 'error' => 'Jenis pasar tidak dikenal.'], 422);
        if (!in_array($arah, ['naik', 'turun', 'keduanya'], true)) json_out(['ok' => false, 'error' => 'Arah tidak dikenal.'], 422);
        if (!in_array($tipe, ['persen', 'nominal'], true)) json_out(['ok' => false, 'error' => 'Tipe batas tidak dikenal.'], 422);
        if (!in_array($periode, ['7 hari', '14 hari', '30 hari'], true)) json_out(['ok' => false, 'error' => 'Periode tidak dikenal.'], 422);
        if ($tipe === 'persen' && ($nilai < 0.5 || $nilai > 100)) json_out(['ok' => false, 'error' => 'Batas persen antara 0,5 dan 100.'], 422);
        if ($tipe === 'nominal' && ($nilai < 50 || $nilai > 1000000)) json_out(['ok' => false, 'error' => 'Batas nominal antara Rp50 dan Rp1.000.000.'], 422);
        $pdo->prepare('INSERT INTO pantauan_harga (pengguna_id, komoditas, wilayah, jenis_pasar, arah, tipe_batas, nilai_batas, periode) VALUES (?,?,?,?,?,?,?,?)')
            ->execute([$uid, $kom, $wil, $jenis, $arah, $tipe, round($nilai, 2), $periode]);
        json_out(['ok' => true, 'pantauan' => rule_out(load_rule((int)$pdo->lastInsertId(), $uid))], 201);
    }

    if ($action === 'ubah') {
        $r = load_rule((int)($in['id'] ?? 0), $uid);
        $pdo->prepare('UPDATE pantauan_harga SET aktif = ? WHERE id = ?')->execute([!empty($in['aktif']) ? 1 : 0, (int)$r['id']]);
        json_out(['ok' => true, 'pantauan' => rule_out(load_rule((int)$r['id'], $uid))]);
    }

    if ($action === 'hapus') {
        $r = load_rule((int)($in['id'] ?? 0), $uid);
        $pdo->prepare('DELETE FROM pantauan_harga WHERE id = ?')->execute([(int)$r['id']]);
        json_out(['ok' => true]);
    }

    if ($action === 'lapor') {
        $r = load_rule((int)($in['id'] ?? 0), $uid);
        $pdo->prepare('UPDATE pantauan_harga SET terakhir_dicek = NOW() WHERE id = ?')->execute([(int)$r['id']]);
        $alert = is_array($in['peringatan'] ?? null) ? $in['peringatan'] : null;
        $sent = null;
        $cooledDown = $r['terakhir_dikirim'] === null || strtotime($r['terakhir_dikirim']) < time() - CHECK_HOURS * 3600;
        if ($alert && (int)$u['notifikasi_harga'] === 1 && (int)$r['aktif'] === 1 && $cooledDown) {
            $end = valid_date($alert['tanggalAkhir'] ?? '');
            $start = valid_date($alert['tanggalAwal'] ?? '');
            if ($end !== (string)$r['tanggal_data_terkirim']) {
                $a = max(0, (int)($alert['hargaAwal'] ?? 0));
                $b = max(0, (int)($alert['hargaAkhir'] ?? 0));
                if ($a > 0 && $b > 0) {
                    $pct = round(($b - $a) / $a * 100, 2);
                    $pdo->prepare('INSERT INTO notifikasi_harga (pengguna_id, pantauan_id, komoditas, wilayah, jenis_pasar, harga_awal, harga_akhir, persen, periode, tanggal_awal, tanggal_akhir) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
                        ->execute([$uid, (int)$r['id'], $r['komoditas'], $r['wilayah'], $r['jenis_pasar'], $a, $b, $pct, $r['periode'], $start, $end]);
                    $nid = (int)$pdo->lastInsertId();
                    $pdo->prepare('UPDATE pantauan_harga SET terakhir_dikirim = NOW(), tanggal_data_terkirim = ? WHERE id = ?')->execute([$end, (int)$r['id']]);
                    $st = $pdo->prepare('SELECT * FROM notifikasi_harga WHERE id = ?');
                    $st->execute([$nid]);
                    $sent = notif_out($st->fetch());
                }
            }
        }
        json_out(['ok' => true, 'terkirim' => $sent]);
    }

    if ($action === 'baca') {
        if (!empty($in['semua'])) $pdo->prepare('UPDATE notifikasi_harga SET dibaca = 1 WHERE pengguna_id = ?')->execute([$uid]);
        else $pdo->prepare('UPDATE notifikasi_harga SET dibaca = 1 WHERE pengguna_id = ? AND id = ?')->execute([$uid, (int)($in['id'] ?? 0)]);
        json_out(['ok' => true]);
    }

    json_out(['ok' => false, 'error' => 'Aksi tidak dikenal.'], 400);
} catch (PDOException $e) {
    error_log('[pangan-pas pantauan] ' . $e->getMessage());
    json_out(['ok' => false, 'error' => 'Server database sedang bermasalah.'], 500);
}
