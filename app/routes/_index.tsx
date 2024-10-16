import { useState, useEffect, useMemo } from "react";
import { useLoaderData } from "@remix-run/react";
import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import {
  S3Client,
  ListObjectsCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { FileList } from "~/components/FileList";
import { FileInfo } from "~/types/types";
import { DropZone } from "~/components/DropZone";
import { Card, CardContent } from "~/components/ui/card";
import ThreeJS from "~/components/ThreeJS";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import BucketStats from "~/components/BucketStats";
import FilterContainer from "~/components/FilterContainer";
import { Button } from "~/components/ui/button";
import { FileStatus } from "~/components/FileStatus";

// AWS S3 Bucket Params
const BUCKET_NAME = "drag-n-drop-site-zelis-us-east-1";
// const BUCKET_NAME = "drag-n-drop-site-zelis";

const s3Client = new S3Client({
  region: "us-east-1",
  // region: "us-east-2",
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY!,
  },
});

// AWS S3 Bucket Loader Functions (gets the files)
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // List files
  const params = {
    Bucket: BUCKET_NAME,
  };

  try {
    const data = await s3Client.send(new ListObjectsCommand(params));
    const fileList =
      data.Contents?.map((file) => ({
        name: file.Key,
        size: file.Size,
        lastModified: file.LastModified,
      })) || [];
    return json({ files: fileList });
  } catch (err) {
    console.error("Error listing files:", err);
    if (err.name === "CredentialsError") {
      return json(
        {
          files: [],
          error:
            "Invalid AWS credentials provided. Please check your configuration.",
        },
        { status: 401 }
      );
    }
    return json({ files: [], error: err.message }, { status: 500 });
  }
};

// AWS S3 Bucket Action Functions (handles deleting, downloading, and uploading files)
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
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    if (file.size > MAX_FILE_SIZE) {
      return json({ error: "File size exceeds 5MB limit" }, { status: 400 });
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
  const [isFlashingOn, setIsFlashingOn] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [fileStatus, setFileStatus] = useState<number>(0);
  // const [filterFileTypes, setFilterFileTypes] = useState<string[]>([]);
  const loaderData = useLoaderData<typeof loader>();
  const [files, setFiles] = useState<FileInfo[]>(loaderData.files);

  // useEffect to re-render the files when they update
  useEffect(() => {
    if (loaderData.files) {
      setFiles(loaderData.files as FileInfo[]);
    }
  }, [loaderData]);

  // Sort the files by last modified date
  const filteredFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      const dateA = new Date(a.lastModified).getTime();
      const dateB = new Date(b.lastModified).getTime();
      return dateB - dateA;
    });
  }, [files]);

  // Add the file type to the file
  // const filesWithTypes = useMemo(() => {
  //   return filteredFiles.map((file) => {
  //     const extension = file.name.split(".").pop()?.toLowerCase() || "";
  //     return { ...file, type: extension };
  //   });
  // }, [filteredFiles]);

  // Save the dark mode state
  useEffect(() => {
    let savedMode = localStorage.getItem("displayMode");
    if (!savedMode) {
      savedMode = "light";
      setDarkMode(false);
      localStorage.setItem("displayMode", savedMode);
    }
    setDarkMode(savedMode === "dark");
  }, []);

  // Toggle the dark mode state
  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem("displayMode", newMode ? "dark" : "light");
      return newMode;
    });
  };

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Set a timer that changes fileStatus every 2 second between 5 steps
  const startFileStatusTimer = () => {
    const steps = [1, 2, 3, 4, 5];
    let index = 0;
    const timer = setInterval(() => {
      setFileStatus(steps[index]);
      index++;
      if (index >= steps.length) {
        clearInterval(timer);
      }
    }, 2000);
    return () => clearInterval(timer);
  };

  return (
    <main className="overflow-hidden">
      <div
        className="h-full w-full absolute right-0 hidden 2xl:block bg-transparent"
        aria-hidden={true}>
        {darkMode && (
          <Button
            className={`absolute bottom-8 right-8 z-50 ${
              isFlashingOn ? "" : "opacity-50 text-muted-foreground"
            }`}
            onClick={() => setIsFlashingOn((prev) => !prev)}
            aria-pressed={isFlashingOn}
            aria-label="Toggle Flashing">
            Effects
          </Button>
        )}
        <ThreeJS darkMode={darkMode} isFlashingOn={isFlashingOn} />
      </div>
      <div className="p-2 bg-white dark:bg-[#101010] md:flex-row md:p-10 flex gap-2 md:gap-6  min-h-screen">
        {/* <div className="md:max-w-sm w-full max-h-[92.8vh] flex flex-col gap-2 md:gap-6">
          <FilterContainer
            className="hidden md:block"
            files={filesWithTypes}
            filterFileTypes={filterFileTypes}
            setFilterFileTypes={setFilterFileTypes}
            aria-label="Filter Files Types"
          />
          <BucketStats className="grow" files={filesWithTypes} />
        </div> */}
        <Card className="md:p-6 pt-6 md:pt-10 w-full max-w-3xl">
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <DropZone
              startFileStatusTimer={startFileStatusTimer}
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
            />
            <FileStatus status={fileStatus} />
            <p className="text-xs italic opacity-30 w-full">
              *runs through a 3 second timer to simulate actual step progress. a
              bit wonky too, but i decided to leave it because it gets the point
              across
            </p>
            <FileList
              files={filteredFiles}
              // filterFileTypes={filterFileTypes}
              aria-label="File List"
              errorMessage={loaderData.error}
            />
          </CardContent>
        </Card>
        {/* <FilterContainer
          className="block md:hidden"
          files={filesWithTypes}
          filterFileTypes={filterFileTypes}
          setFilterFileTypes={setFilterFileTypes}
          aria-label="Filter Files Types"
        /> */}
      </div>
    </main>
  );
}
