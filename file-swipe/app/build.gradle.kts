plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// GitHub Actions 실행 번호가 곧 버전 번호. 숫자가 커야 폰에서 업데이트 설치가 된다.
val ciVersion = System.getenv("VERSION_CODE")?.toIntOrNull() ?: 1

android {
    namespace = "com.homewithreed.fileswipe"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.homewithreed.fileswipe"
        minSdk = 30
        targetSdk = 34
        versionCode = ciVersion
        versionName = "1.$ciVersion"
    }

    // 서명 키는 저장소에 두지 않는다. CI가 GitHub Secret(또는 임시 키)에서
    // 꺼내 아래 환경변수로 넘겨준다. 같은 키로 서명해야 덮어 설치가 된다.
    val keyFile = System.getenv("SIGNING_STORE_FILE")
    val keyPass = System.getenv("SIGNING_PASSWORD")
    if (keyFile != null && keyPass != null) {
        signingConfigs {
            create("release") {
                storeFile = file(keyFile)
                storePassword = keyPass
                keyAlias = "fileswipe"
                keyPassword = keyPass
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

dependencies {
    implementation("androidx.core:core:1.13.1")
}
