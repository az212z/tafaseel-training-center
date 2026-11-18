<?php
declare(strict_types=1);

function serviceDefinitions(): array
{
    return [
        "moyasar" => [
            "label" => "الدفع عبر ميسر",
            "fields" => [
                "mode" => [
                    "label" => "بيئة الدفع",
                    "options" => ["test" => "اختبار", "live" => "تشغيل فعلي"],
                ],
                "secret_key" => [
                    "label" => "المفتاح السري من ميسر",
                    "secret" => true,
                ],
            ],
        ],
        "zoom" => [
            "label" => "اللقاءات المباشرة عبر Zoom",
            "fields" => [
                "account_id" => ["label" => "معرف حساب الجهة"],
                "client_id" => ["label" => "معرف تطبيق الجهة"],
                "client_secret" => [
                    "label" => "المفتاح السري للتطبيق",
                    "secret" => true,
                ],
                "webhook_secret" => [
                    "label" => "مفتاح التحقق من إشعارات Zoom",
                    "secret" => true,
                ],
                "default_host" => [
                    "label" => "بريد المضيف الافتراضي",
                    "optional" => true,
                ],
                "sdk_client_id" => [
                    "label" => "معرّف تطبيق Meeting SDK للبث داخل تفاصيل",
                    "optional" => true,
                ],
                "sdk_client_secret" => [
                    "label" => "مفتاح تطبيق Meeting SDK السري",
                    "optional" => true,
                    "secret" => true,
                ],
            ],
        ],
        "video" => [
            "label" => "الفيديو عبر Bunny Stream",
            "fields" => [
                "library_id" => ["label" => "رقم مكتبة الفيديو"],
                "api_key" => [
                    "label" => "مفتاح إدارة المكتبة",
                    "secret" => true,
                ],
                "token_key" => [
                    "label" => "مفتاح توقيع مشغل الفيديو",
                    "secret" => true,
                ],
            ],
        ],
        "s3" => [
            "label" => "تخزين الملفات الخاص عبر Amazon S3",
            "fields" => [
                "bucket" => ["label" => "اسم الحاوية الخاصة"],
                "region" => ["label" => "منطقة التخزين"],
                "access_key" => [
                    "label" => "معرف مفتاح الوصول",
                    "secret" => true,
                ],
                "secret_key" => [
                    "label" => "مفتاح الوصول السري",
                    "secret" => true,
                ],
            ],
        ],
    ];
}

function serviceConnectionStatuses(): array
{
    $items = [];
    foreach (serviceDefinitions() as $name => $definition) {
        $config = integrationConfig($name);
        $fields = [];
        foreach ($definition["fields"] as $key => $field) {
            $fields[] = [
                "key" => $key,
                ...$field,
                "value" => !empty($field["secret"])
                    ? ""
                    : $config[$key] ?? ($key === "mode" ? "test" : ""),
                "has_value" => !empty($config[$key]),
            ];
        }
        $items[] = [
            "name" => $name,
            "label" => $definition["label"],
            "enabled" => (bool) ($config["enabled"] ?? false),
            "configured" => integrationEnabled($name),
            "fields" => $fields,
        ];
    }
    return [
        "items" => $items,
        "zoom_webhook_url" =>
            rtrim(cfg()["origin"], "/") . "/api/index.php?action=zoom.webhook",
    ];
}

function serviceConnectionAction(
    string $action,
    string $method,
    array $data,
): ?array {
    if (
        !in_array(
            $action,
            ["services.connections", "services.connection.save"],
            true,
        )
    ) {
        return null;
    }
    if ($method !== ($action === "services.connections" ? "GET" : "POST")) {
        fail(405, "طريقة الطلب غير مسموحة.");
    }
    if ($method === "POST") {
        csrf();
    }
    $user = auth(["admin"]);
    staffMfaGuard($user, $action);
    if ($action === "services.connections") {
        return serviceConnectionStatuses();
    }
    $name = $data["service"] ?? "";
    $definition = is_string($name) ? serviceDefinitions()[$name] ?? null : null;
    if (!$definition) {
        fail(422, "اختر خدمة مدعومة.");
    }
    rate("service-config:" . $user["id"] . ":" . $name, 5, 900);
    $account = one("SELECT password FROM users WHERE id=?", [$user["id"]]);
    if (
        !password_verify(
            (string) ($data["current_password"] ?? ""),
            $account["password"],
        )
    ) {
        fail(422, "كلمة مرور الإدارة غير صحيحة.");
    }
    $config = integrationConfig($name);
    $config["enabled"] = ($data["enabled"] ?? false) === true;
    $values = $data["values"] ?? [];
    if (!is_array($values)) {
        fail(422, "بيانات الخدمة غير صحيحة.");
    }
    foreach ($definition["fields"] as $key => $field) {
        $value = $values[$key] ?? "";
        if (
            !is_string($value) ||
            mb_strlen($value) > 2000 ||
            preg_match('/[\r\n\x00]/', $value)
        ) {
            fail(422, "راجع حقل " . $field["label"] . ".");
        }
        $value = trim($value);
        if (!empty($field["secret"]) && $value === "") {
            $value = $config[$key] ?? "";
        }
        if (
            $value !== "" &&
            !empty($field["options"]) &&
            !isset($field["options"][$value])
        ) {
            fail(422, "اختر قيمة صحيحة لحقل " . $field["label"] . ".");
        }
        if ($config["enabled"] && empty($field["optional"]) && $value === "") {
            fail(422, "أكمل حقل " . $field["label"] . " قبل التفعيل.");
        }
        $config[$key] = $value;
    }
    if (
        $name === "moyasar" &&
        $config["enabled"] &&
        !str_starts_with($config["secret_key"], "sk_" . $config["mode"] . "_")
    ) {
        fail(422, "مفتاح ميسر لا يطابق بيئة الدفع المختارة.");
    }
    if (
        $name === "zoom" &&
        $config["default_host"] !== "" &&
        !filter_var($config["default_host"], FILTER_VALIDATE_EMAIL)
    ) {
        fail(422, "أدخل بريدًا صحيحًا للمضيف.");
    }
    if ($name === "zoom" && ($config["sdk_client_id"] === "") !== ($config["sdk_client_secret"] === "")) {
        fail(422, "أكمل معرّف تطبيق Meeting SDK ومفتاحه السري.");
    }
    if (
        $name === "video" &&
        $config["library_id"] !== "" &&
        !preg_match('/^[0-9]{1,20}$/', $config["library_id"])
    ) {
        fail(422, "رقم مكتبة الفيديو غير صحيح.");
    }
    if ($name === "s3") {
        if (
            $config["bucket"] !== "" &&
            !preg_match(
                '/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/',
                $config["bucket"],
            )
        ) {
            fail(422, "اسم حاوية التخزين غير صحيح.");
        }
        if (
            $config["region"] !== "" &&
            !preg_match('/^[a-z]{2}(?:-gov)?-[a-z]+-[0-9]$/', $config["region"])
        ) {
            fail(422, "أدخل منطقة Amazon S3 الصحيحة.");
        }
    }
    setSetting(
        "service_connection_" . $name,
        enc(json_encode($config, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)),
    );
    audit($user, "service.connection_saved", $name);
    return ["ok" => true, "configured" => integrationEnabled($name)];
}
