const http = require("http");

// 워밍업할 페이지 목록
const PAGES_TO_WARMUP = [
  "/",
  "/login",
  "/sites",
  "/documents",
  "/documents/upload",
  "/rag",
];

// HTTP 요청 함수
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 3001,
      path: path,
      method: "GET",
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        console.log(`✅ Warmed up: ${path} (${res.statusCode})`);
        resolve({ path, statusCode: res.statusCode });
      });
    });

    req.on("error", (err) => {
      console.log(`❌ Failed to warm up: ${path} - ${err.message}`);
      resolve({ path, error: err.message });
    });

    req.on("timeout", () => {
      req.destroy();
      console.log(`⏰ Timeout warming up: ${path}`);
      resolve({ path, error: "timeout" });
    });

    req.end();
  });
}

// 서버가 준비될 때까지 대기
function waitForServer(maxAttempts = 30, interval = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const checkServer = () => {
      attempts++;
      console.log(`🔍 서버 상태 확인 중... (${attempts}/${maxAttempts})`);

      const req = http.request(
        {
          hostname: "localhost",
          port: 3001,
          path: "/",
          method: "HEAD",
          timeout: 2000,
        },
        (res) => {
          console.log(`🚀 Next.js 서버 준비 완료!`);
          resolve();
        }
      );

      req.on("error", () => {
        if (attempts >= maxAttempts) {
          reject(new Error("서버 준비 대기 시간 초과"));
        } else {
          setTimeout(checkServer, interval);
        }
      });

      req.on("timeout", () => {
        req.destroy();
        if (attempts >= maxAttempts) {
          reject(new Error("서버 준비 대기 시간 초과"));
        } else {
          setTimeout(checkServer, interval);
        }
      });

      req.end();
    };

    checkServer();
  });
}

// 워밍업 실행
async function warmupPages() {
  try {
    console.log("🔥 Next.js 페이지 워밍업 시작...");

    // 서버 준비 대기
    await waitForServer();

    // 약간의 추가 대기 (컴파일 준비)
    console.log("⏳ 컴파일 준비를 위해 2초 대기...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log(`📄 ${PAGES_TO_WARMUP.length}개 페이지 워밍업 진행...`);

    // 모든 페이지를 병렬로 워밍업
    const results = await Promise.all(
      PAGES_TO_WARMUP.map((page) => makeRequest(page))
    );

    const successful = results.filter(
      (r) => r.statusCode && r.statusCode < 400
    ).length;
    const failed = results.length - successful;

    console.log("🎉 워밍업 완료!");
    console.log(`✅ 성공: ${successful}개`);
    console.log(`❌ 실패: ${failed}개`);

    if (failed === 0) {
      console.log("🚀 모든 페이지가 성공적으로 워밍업되었습니다!");
    }
  } catch (error) {
    console.error("❌ 워밍업 중 오류 발생:", error.message);
  }
}

// 메인 실행
if (require.main === module) {
  warmupPages();
}

module.exports = { warmupPages };
