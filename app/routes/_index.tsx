import { useState, useEffect, useMemo } from "react";
import { useLoaderData } from "@remix-run/react";
import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { FileList } from "~/components/FileList";
import { FileInfo } from "~/types/types";
import { DropZone } from "~/components/DropZone";
import { Card, CardContent } from "~/components/ui/card";
import ThreeJS from "~/components/ThreeJS";
import { Readable } from "stream";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import BucketStats from "~/components/BucketStats";
import FilterContainer from "~/components/FilterContainer";
import { Icon } from "@iconify/react/dist/iconify.js";

const BUCKET_NAME = "drag-n-drop-site-zelis";

const s3Client = new S3Client({
  region: "us-east-2",
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY!,
  },
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // List files
  const params = {
    Bucket: BUCKET_NAME,
  };

  try {
    const data = await s3Client.send(new ListObjectsV2Command(params));
    const fileList =
      data.Contents?.map((file) => ({
        name: file.Key,
        size: file.Size,
        lastModified: file.LastModified,
      })) || [];
    return json({ files: fileList });
  } catch (err) {
    console.error("Error listing files:", err);
    throw new Response("Error listing files", { status: 500 });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const fileName = formData.get("fileName") as string | null;
  const action = formData.get("action") as string | null;

  if (action === "delete" && fileName) {
    // File Deletion
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
    };

    try {
      await s3Client.send(new DeleteObjectCommand(params));
      return json({ success: true, action: "delete" });
    } catch (err) {
      console.error("Error deleting file:", err);
      return json({ error: "Failed to delete file" }, { status: 500 });
    }
  } else if (fileName) {
    // File Download
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
    };

    try {
      const command = new GetObjectCommand(params);
      const preSignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600,
      });

      return json({ preSignedUrl });
    } catch (err) {
      console.error("Error generating pre-signed URL:", err);
      return json(
        { error: "Failed to generate pre-signed URL" },
        { status: 500 }
      );
    }
  } else if (file) {
    // File Upload
    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE) {
      return json({ error: "File size exceeds 450KB limit" }, { status: 400 });
    }

    const params = {
      Bucket: BUCKET_NAME,
      Key: file.name,
      Body: file.stream(),
    };

    try {
      const upload = new Upload({
        client: s3Client,
        params: params,
      });

      await upload.done();
      return json({ success: true, fileName: file.name });
    } catch (error) {
      console.error("Error uploading file:", error);
      return json({ error: "File upload failed" }, { status: 500 });
    }
  } else {
    return json(
      { error: "No file uploaded or specified for download" },
      { status: 400 }
    );
  }
};

export default function Index() {
  const [darkMode, setDarkMode] = useState(false);
  const [filterFileTypes, setFilterFileTypes] = useState<string[]>([]);
  const loaderData = useLoaderData<typeof loader>();
  const [files, setFiles] = useState<FileInfo[]>(() => loaderData.files || []);

  useEffect(() => {
    if (loaderData.files) {
      setFiles(loaderData.files);
    }
  }, [loaderData]);

  const filteredFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      const dateA = new Date(a.lastModified).getTime();
      const dateB = new Date(b.lastModified).getTime();
      return dateB - dateA;
    });
  }, [files]);

  const filesWithTypes = useMemo(() => {
    return filteredFiles.map((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      return { ...file, type: extension };
    });
  }, [filteredFiles]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <main className="overflow-hidden">
      <div className="absolute top-10 right-10 z-10 flex gap-4">
        <a
          href="https://github.com/aidankmcalister/zelis-drag-and-drop"
          target="_blank">
          <Icon
            className="w-8 h-8 hover:scale-110 transition-all"
            icon="fa6-brands:github"
          />
        </a>
        <button onClick={toggleDarkMode}>
          <Icon
            className="w-8 h-8 hover:scale-110 transition-all"
            icon={darkMode ? "fa6-solid:sun" : "fa6-solid:moon"}
          />
        </button>
      </div>
      <div className="h-full w-full absolute right-0 hidden 2xl:block bg-transparent">
        <ThreeJS files={filesWithTypes} />
      </div>
      <div className="p-2 bg-white dark:bg-[#101010] md:flex-row flex-col-reverse md:p-10 flex gap-2 md:gap-6  min-h-screen">
        <div className="md:max-w-sm w-full max-h-[92.8vh] flex flex-col gap-2 md:gap-6">
          <FilterContainer
            className="hidden md:block"
            files={filesWithTypes}
            filterFileTypes={filterFileTypes}
            setFilterFileTypes={setFilterFileTypes}
          />
          <BucketStats className="grow" files={filesWithTypes} />
        </div>
        <Card className="md:p-6 pt-6 md:pt-10 w-full max-w-3xl">
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <DropZone />
            <FileList
              files={filesWithTypes}
              filterFileTypes={filterFileTypes}
            />
          </CardContent>
        </Card>
        <FilterContainer
          className="block md:hidden"
          files={filesWithTypes}
          filterFileTypes={filterFileTypes}
          setFilterFileTypes={setFilterFileTypes}
        />
      </div>
    </main>
  );
}
