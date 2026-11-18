<?php
declare(strict_types=1);

function quizDraft(array $attempt): array
{
    $row = one("SELECT * FROM quiz_answer_drafts WHERE attempt_id=?", [
        $attempt["id"],
    ]);
    return [
        "answers" => $row
            ? json_decode(dec($row["answers"]), true, 64, JSON_THROW_ON_ERROR)
            : array_fill(0, (int) $attempt["total"], null),
        "revision" => (int) ($row["revision"] ?? 0),
        "saved_at" => $row["saved_at"] ?? null,
    ];
}

function saveQuizAnswers(array $user, array $data): array
{
    $id = str($data["id"] ?? "", 40);
    $changes = $data["changes"] ?? null;
    if (
        !is_array($changes) ||
        !array_is_list($changes) ||
        count($changes) < 1 ||
        count($changes) > 50
    ) {
        fail(422, "تغييرات الإجابات غير صحيحة.");
    }
    return tx(function () use ($user, $id, $changes) {
        lockRow("attempts", $id);
        $attempt = one("SELECT * FROM attempts WHERE id=? AND student_id=?", [
            $id,
            $user["id"],
        ]);
        if (!$attempt) {
            fail(404, "المحاولة غير موجودة.");
        }
        $quiz = one(
            "SELECT course_id FROM quizzes q WHERE id=? AND " .
                recordAvailable("quiz", "q.id"),
            [$attempt["quiz_id"]],
        );
        courseAccess($user, $quiz["course_id"]);
        if ($attempt["submitted_at"]) {
            fail(409, "تم تسليم المحاولة؛ لا يمكن تغيير الإجابات.");
        }
        if (time() > strtotime($attempt["expires_at"])) {
            fail(
                409,
                "انتهت مهلة الاختبار؛ ستُعتمد الإجابات المحفوظة قبل انتهائها.",
            );
        }
        $draft = quizDraft($attempt);
        $answers = $draft["answers"];
        $questions = json_decode($attempt["questions"], true);
        $seen = [];
        foreach ($changes as $change) {
            $index = is_array($change) ? $change["question"] ?? null : null;
            if (
                !is_int($index) ||
                !isset($questions[$index]) ||
                isset($seen[$index]) ||
                !array_key_exists("answer", $change)
            ) {
                fail(422, "رقم السؤال أو تغييرات الإجابات غير صحيحة.");
            }
            $answer = $change["answer"];
            if (
                $answer !== null &&
                (!is_int($answer) ||
                    $answer < 0 ||
                    $answer >= count($questions[$index]["options"]))
            ) {
                fail(422, "اختر إجابة صحيحة من خيارات السؤال.");
            }
            $seen[$index] = true;
            $answers[$index] = $answer;
        }
        if ($answers !== $draft["answers"]) {
            $draft["answers"] = $answers;
            $draft["revision"]++;
            $draft["saved_at"] = now();
            if ($draft["revision"] === 1) {
                run(
                    "INSERT INTO quiz_answer_drafts(attempt_id,answers,revision,saved_at) VALUES(?,?,?,?)",
                    [
                        $id,
                        enc(json_encode($answers)),
                        $draft["revision"],
                        $draft["saved_at"],
                    ],
                );
            } else {
                run(
                    "UPDATE quiz_answer_drafts SET answers=?,revision=?,saved_at=? WHERE attempt_id=?",
                    [
                        enc(json_encode($answers)),
                        $draft["revision"],
                        $draft["saved_at"],
                        $id,
                    ],
                );
            }
        }
        return ["draft" => $draft, "server_time" => now()];
    });
}
