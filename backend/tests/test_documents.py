def test_upload_validation(client, admin_headers):
    r = client.post("/api/documents", headers=admin_headers, files={"file": ("bad.exe", b"MZ", "application/octet-stream")})
    assert r.status_code == 415
    r = client.post("/api/documents", headers=admin_headers, files={"file": ("empty.txt", b"", "text/plain")})
    assert r.status_code == 400


def test_upload_list_reindex_delete(client, admin_headers, student_headers, indexed_document):
    assert indexed_document["chunk_count"] > 5
    assert any(d["id"] == indexed_document["id"] for d in client.get("/api/documents", headers=student_headers).json())
    body = ("Photosynthesis is the process by which plants convert light into chemical energy. " * 6).encode()
    up = client.post("/api/documents", headers=admin_headers, files={"file": ("bio.txt", body, "text/plain")}).json()
    doc = client.get(f"/api/documents/{up['id']}", headers=admin_headers).json()
    assert doc["status"] == "ready"
    assert client.post(f"/api/documents/{up['id']}/reindex", headers=admin_headers).status_code == 200
    assert client.delete(f"/api/documents/{up['id']}", headers=admin_headers).status_code == 204
    assert client.get(f"/api/documents/{up['id']}", headers=admin_headers).status_code == 404


def test_failed_ingestion_is_reported(client, admin_headers):
    r = client.post("/api/documents", headers=admin_headers, files={"file": ("tiny.txt", b"hi", "text/plain")}).json()
    doc = client.get(f"/api/documents/{r['id']}", headers=admin_headers).json()
    assert doc["status"] == "failed" and doc["error"]
    client.delete(f"/api/documents/{r['id']}", headers=admin_headers)
